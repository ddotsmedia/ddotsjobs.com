import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, asc, desc, eq, isNull, sql, tables } from '@ddotsjobs/db';
import { callAI } from '@ddotsjobs/ai';
import { walkinGenerateNoticePrompt } from '@ddotsjobs/ai/prompts';
import { redis } from '@ddotsjobs/redis';
import { roleProcedure, router } from '../trpc.js';
import { assertAiEnabled } from '@/lib/site-settings';

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtTime(d: Date): string {
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function salaryText(min: number | null, max: number | null, disclosed: boolean): string {
  if (!disclosed || min == null) return 'Salary as per qualification';
  const a = `₹${Math.round(min / 100).toLocaleString('en-IN')}`;
  if (max != null) return `${a} – ₹${Math.round(max / 100).toLocaleString('en-IN')}/mo`;
  return `${a}/mo`;
}

function fallbackNotice(d: {
  companyName: string;
  jobTitle: string;
  jobTitleMl: string | null;
  date: string;
  time: string;
  venue: string;
  salaryRange: string;
  requirements: string[];
  contactPhone: string | null;
}): string {
  return (
    `🔔 *Walk-in Interview / വാക്ക്-ഇൻ ഇന്റർവ്യൂ*\n\n` +
    `*${d.companyName}*\n` +
    `💼 ${d.jobTitleMl ?? d.jobTitle}\n` +
    `📅 ${d.date}\n` +
    `🕒 ${d.time}\n` +
    `📍 ${d.venue}\n` +
    `💰 ${d.salaryRange}\n` +
    (d.requirements.length ? `📄 ${d.requirements.join(', ')}\n` : '') +
    (d.contactPhone ? `📞 ${d.contactPhone}\n` : '') +
    `\n👉 ddotsjobs.com`
  );
}

export const walkinRouter = router({
  generateNotice: roleProcedure('employer')
    .input(
      z.object({
        jobId: z.string().uuid(),
        language: z.enum(['ml', 'en']).default('ml'),
        contactPhone: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertAiEnabled();
      const j = tables.jobs;
      const [job] = await ctx.db
        .select({
          id: j.id,
          title: j.titleEn,
          titleMl: j.titleMl,
          isWalkIn: j.isWalkIn,
          district: j.district,
          salaryMinPaise: j.salaryMinPaise,
          salaryMaxPaise: j.salaryMaxPaise,
          salaryDisclosed: j.salaryDisclosed,
          requiredCertifications: j.requiredCertifications,
          companyName: sql<string>`coalesce(${tables.employers.displayNameEn}, ${tables.employers.legalNameEn})`,
          employerPhone: tables.employers.contactPhone,
        })
        .from(j)
        .innerJoin(tables.employers, eq(tables.employers.id, j.employerId))
        .where(and(eq(j.id, input.jobId), eq(tables.employers.ownerUserId, ctx.user.id), isNull(j.deletedAt)))
        .limit(1);
      if (!job) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your job' });
      if (!job.isWalkIn) throw new TRPCError({ code: 'BAD_REQUEST', message: 'This is not a walk-in job' });

      const [ev] = await ctx.db
        .select({
          startsAt: tables.walkInEvents.startsAt,
          endsAt: tables.walkInEvents.endsAt,
          venueEn: tables.walkInEvents.venueEn,
          instructionsMl: tables.walkInEvents.instructionsMl,
        })
        .from(tables.walkInEvents)
        .where(and(eq(tables.walkInEvents.jobId, input.jobId), isNull(tables.walkInEvents.deletedAt)))
        .orderBy(asc(tables.walkInEvents.startsAt))
        .limit(1);

      const date = ev ? fmtDate(ev.startsAt) : 'TBA';
      const time = ev ? `${fmtTime(ev.startsAt)}${ev.endsAt ? ` – ${fmtTime(ev.endsAt)}` : ''}` : 'TBA';
      const venue = ev?.venueEn ?? 'See instructions';
      const salaryRange = salaryText(job.salaryMinPaise, job.salaryMaxPaise, job.salaryDisclosed);
      const docs = ev?.instructionsMl ? ev.instructionsMl.split(/[,\n]/).map((x) => x.trim()).filter(Boolean) : [];
      const requirements = [...job.requiredCertifications, ...docs];
      const contactPhone = input.contactPhone ?? job.employerPhone ?? null;

      const fb = fallbackNotice({
        companyName: job.companyName,
        jobTitle: job.title,
        jobTitleMl: job.titleMl,
        date,
        time,
        venue,
        salaryRange,
        requirements,
        contactPhone,
      });

      try {
        const spec = walkinGenerateNoticePrompt({
          jobTitle: job.title,
          jobTitleMl: job.titleMl,
          companyName: job.companyName,
          district: job.district ?? '',
          walkInDate: date,
          walkInTime: time,
          venue,
          salaryRange,
          requirements,
          contactPhone,
          language: input.language,
        });
        const { data } = await callAI({ task: spec.task, prompt: spec.prompt, system: spec.system, schema: spec.schema });
        return { noticeText: data.notice, language: input.language };
      } catch (err) {
        console.error('[walkin] AI failed, using fallback:', String(err));
        return { noticeText: fb, language: input.language };
      }
    }),

  saveNotice: roleProcedure('employer')
    .input(z.object({ jobId: z.string().uuid(), noticeText: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [ev] = await ctx.db
        .select({ id: tables.walkInEvents.id })
        .from(tables.walkInEvents)
        .innerJoin(tables.jobs, eq(tables.jobs.id, tables.walkInEvents.jobId))
        .innerJoin(tables.employers, eq(tables.employers.id, tables.jobs.employerId))
        .where(and(eq(tables.walkInEvents.jobId, input.jobId), eq(tables.employers.ownerUserId, ctx.user.id)))
        .limit(1);
      if (ev) {
        await ctx.db
          .update(tables.walkInEvents)
          .set({ noticeGeneratedAt: new Date() })
          .where(eq(tables.walkInEvents.id, ev.id));
      }
      await redis.set(`walkin:notice:${input.jobId}`, input.noticeText, 'EX', 86_400);
      return { saved: true as const };
    }),

  myDrives: roleProcedure('employer').query(async ({ ctx }) => {
    const w = tables.walkInEvents;
    return ctx.db
      .select({
        jobId: w.jobId,
        venueEn: w.venueEn,
        startsAt: w.startsAt,
        noticeGeneratedAt: w.noticeGeneratedAt,
        title: tables.jobs.titleEn,
        district: tables.jobs.district,
        registrations: tables.jobs.applicationCount,
        knmcVerified: sql<number>`(SELECT count(*)::int FROM applications ap JOIN professional_registrations pr ON pr.user_id = ap.seeker_user_id AND pr.type_code = 'KNMC' AND pr.status_code = 'verified' WHERE ap.job_id = ${w.jobId} AND ap.withdrawn_at IS NULL)`,
      })
      .from(w)
      .innerJoin(tables.jobs, eq(tables.jobs.id, w.jobId))
      .innerJoin(tables.employers, eq(tables.employers.id, tables.jobs.employerId))
      .where(and(eq(tables.employers.ownerUserId, ctx.user.id), isNull(w.deletedAt)))
      .orderBy(desc(w.startsAt))
      .limit(10);
  }),
});
