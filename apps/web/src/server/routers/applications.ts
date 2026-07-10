import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, createNotification, desc, eq, isNull, sql, tables, type Database } from '@ddotsjobs/db';
import { uploadFile } from '@ddotsjobs/storage';
import { callAI } from '@ddotsjobs/ai';
import { applicationCoverLetterPrompt } from '@ddotsjobs/ai/prompts';
import { computeFitScore, type FitScoreResult } from '@/lib/services/fit-score.service';
import { stripHtml } from '@/lib/sanitize';
import { roleProcedure, router } from '../trpc.js';
import { rateLimit } from '../rate-limit.js';
import { assertAiEnabled } from '@/lib/site-settings';
import { logAction } from '@/lib/audit';
import { awardReferralOnApply } from '../lib/referral-award.js';

const VOICE_EXT: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
};
const MAX_VOICE_BYTES = 10 * 1024 * 1024;

// status_code -> application_status enum (NOT NULL column).
const STATUS_ENUM: Record<string, 'viewed' | 'shortlisted' | 'interview' | 'offered' | 'rejected'> = {
  under_review: 'viewed',
  shortlisted: 'shortlisted',
  interview_scheduled: 'interview',
  interviewed: 'interview',
  offer_made: 'offered',
  rejected: 'rejected',
};

async function computeFitForApply(db: Database, userId: string, jobId: string): Promise<FitScoreResult> {
  const j = tables.jobs;
  const [job] = await db
    .select({
      district: j.district,
      category: j.categorySlug,
      minExperienceMonths: j.minExperienceMonths,
      salaryMinPaise: j.salaryMinPaise,
      salaryMaxPaise: j.salaryMaxPaise,
      salaryDisclosed: j.salaryDisclosed,
      languageRequirement: j.languageRequirement,
      requiredCertifications: j.requiredCertifications,
    })
    .from(j)
    .where(eq(j.id, jobId))
    .limit(1);

  const sp = tables.seekerProfiles;
  const [seeker] = await db
    .select({
      totalExperienceMonths: sp.totalExperienceMonths,
      homeDistrict: sp.homeDistrict,
      salaryMinPaise: sp.expectedSalaryMinPaise,
      salaryMaxPaise: sp.expectedSalaryMaxPaise,
      preferredCategories: sp.preferredCategories,
      preferredLanguage: tables.users.preferredLanguage,
    })
    .from(sp)
    .innerJoin(tables.users, eq(tables.users.id, sp.userId))
    .where(eq(sp.userId, userId))
    .limit(1);

  const regs = await db
    .select({ type: tables.professionalRegistrations.typeCode, status: tables.professionalRegistrations.statusCode })
    .from(tables.professionalRegistrations)
    .where(and(eq(tables.professionalRegistrations.userId, userId), isNull(tables.professionalRegistrations.deletedAt)));

  return computeFitScore({
    seeker: {
      totalExperienceMonths: seeker?.totalExperienceMonths ?? 0,
      primaryDistrict: seeker?.homeDistrict ?? null,
      willingDistricts: [],
      salaryMinPaise: seeker?.salaryMinPaise ?? null,
      salaryMaxPaise: seeker?.salaryMaxPaise ?? null,
      preferredCategories: seeker?.preferredCategories ?? [],
      preferredLanguage: seeker?.preferredLanguage ?? 'ml',
      professionalRegistrations: regs.map((r) => ({ type: r.type ?? '', verificationStatus: r.status })),
    },
    job: {
      district: job?.district ?? '',
      category: job?.category ?? '',
      minExperienceMonths: job?.minExperienceMonths ?? 0,
      maxExperienceMonths: null,
      salaryMinPaise: job?.salaryMinPaise ?? null,
      salaryMaxPaise: job?.salaryMaxPaise ?? null,
      salaryDisclosed: job?.salaryDisclosed ?? false,
      languageRequirement: job?.languageRequirement ?? 'both',
      requiredCertifications: job?.requiredCertifications ?? [],
    },
  });
}

export const applicationsRouter = router({
  generateCoverLetter: roleProcedure('seeker')
    .input(z.object({ jobId: z.string().uuid(), language: z.enum(['ml', 'en']).default('en') }))
    .mutation(async ({ ctx, input }) => {
      await assertAiEnabled();
      await rateLimit(ctx.redis, `coverletter:${ctx.user.id}`, 20, 86_400);
      const [job] = await ctx.db
        .select({
          titleEn: tables.jobs.titleEn,
          district: tables.jobs.district,
          employerQuestionEn: tables.jobs.employerQuestionEn,
          company: sql<string>`coalesce(${tables.employers.displayNameEn}, ${tables.employers.legalNameEn})`,
        })
        .from(tables.jobs)
        .innerJoin(tables.employers, eq(tables.employers.id, tables.jobs.employerId))
        .where(and(eq(tables.jobs.id, input.jobId), isNull(tables.jobs.deletedAt)))
        .limit(1);
      if (!job) throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' });

      const [u] = await ctx.db
        .select({ nameEn: tables.users.nameEn, primaryProfession: tables.users.primaryProfession })
        .from(tables.users)
        .where(eq(tables.users.id, ctx.user.id))
        .limit(1);
      const [p] = await ctx.db
        .select({ months: tables.seekerProfiles.totalExperienceMonths })
        .from(tables.seekerProfiles)
        .where(eq(tables.seekerProfiles.userId, ctx.user.id))
        .limit(1);

      const spec = applicationCoverLetterPrompt({
        seekerName: u?.nameEn ?? 'Applicant',
        seekerProfession: u?.primaryProfession ?? 'professional',
        totalExperienceMonths: p?.months ?? 0,
        jobTitle: job.titleEn,
        companyName: job.company,
        district: job.district ?? '',
        employerQuestion: job.employerQuestionEn,
        language: input.language,
      });
      const { data } = await callAI({ task: spec.task, prompt: spec.prompt, system: spec.system, schema: spec.schema });
      return data;
    }),

  create: roleProcedure('seeker')
    .input(
      z.object({
        jobId: z.string().uuid(),
        questionResponse: z.string().max(1000).optional(),
        voiceNoteBase64: z.string().optional(),
        voiceNoteMimeType: z.enum(['audio/webm', 'audio/mp4', 'audio/ogg']).optional(),
        voiceNoteDurationS: z.number().int().max(120).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await rateLimit(ctx.redis, `apply:${ctx.user.id}`, 20, 86_400);
      const j = tables.jobs;
      const [job] = await ctx.db
        .select({ id: j.id, employerId: j.employerId, employerQuestionEn: j.employerQuestionEn })
        .from(j)
        .where(and(eq(j.id, input.jobId), eq(j.status, 'active'), isNull(j.deletedAt)))
        .limit(1);
      if (!job) throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not available' });

      if (job.employerQuestionEn?.trim() && !input.questionResponse?.trim()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Answer the employer question' });
      }

      const [dup] = await ctx.db
        .select({ id: tables.applications.id })
        .from(tables.applications)
        .where(
          and(
            eq(tables.applications.jobId, input.jobId),
            eq(tables.applications.seekerUserId, ctx.user.id),
            isNull(tables.applications.deletedAt),
          ),
        )
        .limit(1);
      if (dup) throw new TRPCError({ code: 'CONFLICT', message: 'Already applied' });

      const fit = await computeFitForApply(ctx.db, ctx.user.id, input.jobId);

      let voiceKey: string | null = null;
      if (input.voiceNoteBase64 && input.voiceNoteMimeType) {
        const b64 = input.voiceNoteBase64.replace(/^data:[^;]+;base64,/, '');
        const buf = Buffer.from(b64, 'base64');
        if (buf.byteLength > MAX_VOICE_BYTES) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Voice note too large' });
        }
        const ext = VOICE_EXT[input.voiceNoteMimeType] ?? 'webm';
        voiceKey = `voice-notes/${ctx.user.id}/${input.jobId}-${Date.now()}.${ext}`;
        await uploadFile(voiceKey, buf, input.voiceNoteMimeType);
      }

      const [row] = await ctx.db
        .insert(tables.applications)
        .values({
          jobId: input.jobId,
          seekerUserId: ctx.user.id,
          employerId: job.employerId,
          status: 'applied',
          statusCode: 'applied',
          fitScore: fit.overall,
          fitScoreAtApply: fit.overall,
          fitBreakdownAtApply: {
            qualification: fit.qualification,
            experience: fit.experience,
            location: fit.location,
            salary: fit.salary,
            language: fit.language,
            certBonus: fit.certBonus,
          },
          questionResponse: input.questionResponse ? stripHtml(input.questionResponse) : null,
          hasVoiceNote: Boolean(voiceKey),
          voiceNoteR2Key: voiceKey,
          voiceNoteDurationS: input.voiceNoteDurationS ?? null,
          appliedVia: 'web',
        })
        .returning({ id: tables.applications.id });
      if (!row) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      await ctx.db
        .update(j)
        .set({ applicationCount: sql`${j.applicationCount} + 1` })
        .where(eq(j.id, input.jobId));

      await logAction(ctx, 'job.applied', 'job', input.jobId, { applicationId: row.id });
      return { applicationId: row.id, fitScore: fit.overall };
    }),

  // ── Quick Apply: one-click application using saved profile ───────────
  checkCanQuickApply: roleProcedure('seeker')
    .input(z.object({ jobId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [profile] = await ctx.db
        .select({ completionPct: tables.seekerProfiles.completionPct })
        .from(tables.seekerProfiles)
        .where(eq(tables.seekerProfiles.userId, ctx.user.id))
        .limit(1);
      const completionPct = profile?.completionPct ?? 0;

      const [dup] = await ctx.db
        .select({ id: tables.applications.id })
        .from(tables.applications)
        .where(and(eq(tables.applications.jobId, input.jobId), eq(tables.applications.seekerUserId, ctx.user.id), isNull(tables.applications.deletedAt)))
        .limit(1);
      const alreadyApplied = !!dup;

      const [job] = await ctx.db
        .select({ id: tables.jobs.id })
        .from(tables.jobs)
        .where(and(eq(tables.jobs.id, input.jobId), eq(tables.jobs.status, 'active'), isNull(tables.jobs.deletedAt)))
        .limit(1);

      let reason: string | null = null;
      let canQuickApply = true;
      if (!job) { canQuickApply = false; reason = 'This job is no longer active.'; }
      else if (alreadyApplied) { canQuickApply = false; reason = 'You have already applied to this job.'; }
      else if (completionPct < 60) { canQuickApply = false; reason = `Complete at least 60% of your profile to use Quick Apply. Your profile is ${completionPct}% complete.`; }

      return { canQuickApply, reason, completionPct, alreadyApplied };
    }),

  quickApply: roleProcedure('seeker')
    .input(z.object({ jobId: z.string().uuid(), coverNote: z.string().max(300).optional(), referralCode: z.string().max(20).optional() }))
    .mutation(async ({ ctx, input }) => {
      await rateLimit(ctx.redis, `apply:${ctx.user.id}`, 20, 86_400);
      const [profile] = await ctx.db
        .select({ completionPct: tables.seekerProfiles.completionPct, name: tables.users.nameEn })
        .from(tables.seekerProfiles)
        .innerJoin(tables.users, eq(tables.users.id, tables.seekerProfiles.userId))
        .where(eq(tables.seekerProfiles.userId, ctx.user.id))
        .limit(1);
      const completionPct = profile?.completionPct ?? 0;
      if (completionPct < 60) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: `Complete at least 60% of your profile to use Quick Apply. Your profile is ${completionPct}% complete.` });
      }

      const j = tables.jobs;
      const [job] = await ctx.db
        .select({ id: j.id, employerId: j.employerId, title: j.titleEn, ownerUserId: tables.employers.ownerUserId })
        .from(j)
        .innerJoin(tables.employers, eq(tables.employers.id, j.employerId))
        .where(and(eq(j.id, input.jobId), eq(j.status, 'active'), isNull(j.deletedAt), sql`(${j.expiresAt} is null or ${j.expiresAt} > now())`))
        .limit(1);
      if (!job) throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not available' });

      const [dup] = await ctx.db
        .select({ id: tables.applications.id })
        .from(tables.applications)
        .where(and(eq(tables.applications.jobId, input.jobId), eq(tables.applications.seekerUserId, ctx.user.id), isNull(tables.applications.deletedAt)))
        .limit(1);
      if (dup) throw new TRPCError({ code: 'CONFLICT', message: 'You have already applied to this job.' });

      const fit = await computeFitForApply(ctx.db, ctx.user.id, input.jobId);
      const [row] = await ctx.db
        .insert(tables.applications)
        .values({
          jobId: input.jobId,
          seekerUserId: ctx.user.id,
          employerId: job.employerId,
          status: 'applied',
          statusCode: 'applied',
          isQuickApply: true,
          fitScore: fit.overall,
          fitScoreAtApply: fit.overall,
          fitBreakdownAtApply: { qualification: fit.qualification, experience: fit.experience, location: fit.location, salary: fit.salary, language: fit.language, certBonus: fit.certBonus },
          questionResponse: input.coverNote ? stripHtml(input.coverNote) : null,
          appliedVia: 'quick_apply',
        })
        .returning({ id: tables.applications.id });
      if (!row) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      await ctx.db.update(j).set({ applicationCount: sql`${j.applicationCount} + 1` }).where(eq(j.id, input.jobId));

      // Referral attribution (best-effort — never blocks the application).
      if (input.referralCode) await awardReferralOnApply(ctx.db, input.referralCode, ctx.user.id, input.jobId);

      await createNotification({
        userId: job.ownerUserId,
        type: 'application.received',
        title: 'New quick application',
        body: `${profile?.name ?? 'A candidate'} applied to ${job.title}`,
        actionUrl: '/employer/applications',
      });
      await createNotification({
        userId: ctx.user.id,
        type: 'application.submitted',
        title: 'Application submitted ✓',
        titleMl: 'Application submit ചെയ്തു ✓',
        body: `Applied to ${job.title}`,
        actionUrl: '/seeker/applications',
      });

      await logAction(ctx, 'job.applied', 'job', input.jobId, { applicationId: row.id, quick: true });
      return { success: true as const, applicationId: row.id, fitScore: fit.overall };
    }),

  myApplications: roleProcedure('seeker')
    .input(
      z.object({
        status: z.string().optional(),
        cursor: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(20).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const a = tables.applications;
      const conds = [eq(a.seekerUserId, ctx.user.id), isNull(a.withdrawnAt), isNull(a.deletedAt)];
      if (input.status) conds.push(eq(a.statusCode, input.status));
      if (input.cursor) {
        conds.push(
          sql`(${a.createdAt}, ${a.id}) < ((SELECT created_at FROM applications WHERE id = ${input.cursor}), ${input.cursor}::uuid)`,
        );
      }

      const rows = await ctx.db
        .select({
          id: a.id,
          statusCode: a.statusCode,
          isQuickApply: a.isQuickApply,
          fitScoreAtApply: a.fitScoreAtApply,
          fitBreakdownAtApply: a.fitBreakdownAtApply,
          createdAt: a.createdAt,
          interviewScheduledAt: a.interviewScheduledAt,
          title: tables.jobs.titleEn,
          slug: tables.jobs.slug,
          district: tables.jobs.district,
          salaryMinPaise: tables.jobs.salaryMinPaise,
          salaryDisclosed: tables.jobs.salaryDisclosed,
          isWalkIn: tables.jobs.isWalkIn,
          displayNameEn: tables.employers.displayNameEn,
          legalNameEn: tables.employers.legalNameEn,
          logoR2Key: tables.employers.logoR2Key,
        })
        .from(a)
        .innerJoin(tables.jobs, eq(tables.jobs.id, a.jobId))
        .innerJoin(tables.employers, eq(tables.employers.id, a.employerId))
        .where(and(...conds))
        .orderBy(desc(a.createdAt), desc(a.id))
        .limit(input.limit);

      const items = rows.map((r) => ({
        ...r,
        company: r.displayNameEn ?? r.legalNameEn,
      }));
      const nextCursor = items.length === input.limit ? (items[items.length - 1]?.id ?? null) : null;
      return { items, nextCursor };
    }),

  withdraw: roleProcedure('seeker')
    .input(z.object({ applicationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(tables.applications)
        .set({ withdrawnAt: new Date(), status: 'withdrawn', statusCode: 'withdrawn' })
        .where(
          and(eq(tables.applications.id, input.applicationId), eq(tables.applications.seekerUserId, ctx.user.id)),
        );
      return { success: true as const };
    }),

  getForEmployer: roleProcedure('employer')
    .input(
      z.object({
        jobId: z.string().uuid(),
        status: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const [owned] = await ctx.db
        .select({ id: tables.jobs.id })
        .from(tables.jobs)
        .innerJoin(tables.employers, eq(tables.employers.id, tables.jobs.employerId))
        .where(and(eq(tables.jobs.id, input.jobId), eq(tables.employers.ownerUserId, ctx.user.id)))
        .limit(1);
      if (!owned) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your job' });

      const a = tables.applications;
      const conds = [eq(a.jobId, input.jobId), isNull(a.withdrawnAt), isNull(a.deletedAt)];
      if (input.status) conds.push(eq(a.statusCode, input.status));

      return ctx.db
        .select({
          id: a.id,
          statusCode: a.statusCode,
          fitScoreAtApply: a.fitScoreAtApply,
          createdAt: a.createdAt,
          hasVoiceNote: a.hasVoiceNote,
          questionResponse: a.questionResponse,
          interviewScheduledAt: a.interviewScheduledAt,
          fullName: tables.users.nameEn,
          fullNameMl: tables.users.nameMl,
          currentDistrict: tables.seekerProfiles.currentDistrict,
          totalExperienceMonths: tables.seekerProfiles.totalExperienceMonths,
          isVerifiedProfessional: tables.users.isVerifiedProfessional,
        })
        .from(a)
        .innerJoin(tables.users, eq(tables.users.id, a.seekerUserId))
        .leftJoin(tables.seekerProfiles, eq(tables.seekerProfiles.userId, a.seekerUserId))
        .where(and(...conds))
        .orderBy(sql`${a.fitScoreAtApply} desc nulls last`, desc(a.createdAt))
        .limit(input.limit);
    }),

  updateStatus: roleProcedure('employer')
    .input(
      z.object({
        applicationId: z.string().uuid(),
        status: z.enum([
          'under_review', 'shortlisted', 'interview_scheduled', 'interviewed', 'offer_made', 'rejected',
        ]),
        interviewAt: z.string().datetime().optional(),
        employerNote: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const a = tables.applications;
      const [app] = await ctx.db
        .select({
          id: a.id,
          employerId: a.employerId,
          oldStatus: a.statusCode,
          seekerUserId: a.seekerUserId,
          jobTitle: tables.jobs.titleEn,
          companyName: sql<string>`coalesce(${tables.employers.displayNameEn}, ${tables.employers.legalNameEn})`,
        })
        .from(a)
        .innerJoin(tables.employers, eq(tables.employers.id, a.employerId))
        .innerJoin(tables.jobs, eq(tables.jobs.id, a.jobId))
        .where(and(eq(a.id, input.applicationId), eq(tables.employers.ownerUserId, ctx.user.id)))
        .limit(1);
      if (!app) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your applicant' });

      const now = new Date();
      await ctx.db
        .update(a)
        .set({
          statusCode: input.status,
          status: STATUS_ENUM[input.status] ?? 'viewed',
          statusUpdatedAt: now,
          statusChangedAt: now,
          interviewScheduledAt: input.interviewAt ? new Date(input.interviewAt) : undefined,
          employerNote: input.employerNote ?? undefined,
        })
        .where(eq(a.id, input.applicationId));

      await ctx.db.insert(tables.auditLog).values({
        actorUserId: ctx.user.id,
        action: 'application.status_changed',
        entityType: 'application',
        entityId: input.applicationId,
        diff: { old: app.oldStatus, new: input.status },
      });

      // Notify the seeker on key transitions.
      if (input.status === 'shortlisted') {
        await createNotification({
          userId: app.seekerUserId,
          type: 'application.shortlisted',
          title: 'You have been shortlisted',
          titleMl: 'നിങ്ങൾ shortlist ചെയ്യപ്പെട്ടു',
          body: `${app.companyName} shortlisted you for ${app.jobTitle}`,
          bodyMl: `${app.jobTitle} തസ്തികയിലേക്ക് ${app.companyName} നിങ്ങളെ shortlist ചെയ്തിരിക്കുന്നു`,
          actionUrl: '/seeker/applications',
        });
      } else if (input.status === 'interview_scheduled') {
        const when = input.interviewAt
          ? new Date(input.interviewAt).toLocaleString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
          : 'soon';
        await createNotification({
          userId: app.seekerUserId,
          type: 'application.interview',
          title: 'Interview scheduled',
          titleMl: 'Interview schedule ചെയ്തിരിക്കുന്നു',
          body: `Interview on ${when}`,
          bodyMl: `Interview: ${when}`,
          actionUrl: '/seeker/applications',
        });
      }

      return { success: true as const };
    }),
});
