import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, eq, isNull, tables } from '@ddotsjobs/db';
import { uploadFile } from '@ddotsjobs/storage';
import { aiQueue } from '../queue.js';
import { protectedProcedure, roleProcedure, router } from '../trpc.js';

const TYPE_CODES = ['KNMC', 'KTET', 'KMC', 'Bar_Council', 'ITI', 'ASAP', 'Pharmacy_Council'] as const;
type TypeCode = (typeof TYPE_CODES)[number];

// Map spec credential codes -> professional_registration_type enum (NOT NULL).
type RegEnum =
  | 'nurses_council'
  | 'medical_council'
  | 'pharmacy_council'
  | 'bar_council'
  | 'engineering_board'
  | 'teaching_eligibility'
  | 'iti_ncvt'
  | 'other';
const TYPE_ENUM: Record<TypeCode, RegEnum> = {
  KNMC: 'nurses_council',
  KTET: 'teaching_eligibility',
  KMC: 'medical_council',
  Bar_Council: 'bar_council',
  ITI: 'iti_ncvt',
  ASAP: 'other',
  Pharmacy_Council: 'pharmacy_council',
};

const EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

const MAX_BYTES = 5 * 1024 * 1024;

export const verificationRouter = router({
  submit: roleProcedure('seeker')
    .input(
      z.object({
        type: z.enum(TYPE_CODES),
        registrationNumber: z.string().min(3).max(100),
        documentBase64: z.string().min(1),
        documentMimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const t = tables.professionalRegistrations;

      // Block re-submission of an already-verified credential.
      const [existing] = await ctx.db
        .select({ statusCode: t.statusCode })
        .from(t)
        .where(and(eq(t.userId, ctx.user.id), eq(t.typeCode, input.type), isNull(t.deletedAt)))
        .limit(1);
      if (existing?.statusCode === 'verified') {
        throw new TRPCError({ code: 'CONFLICT', message: 'Already verified' });
      }

      // Decode + size guard.
      const base64 = input.documentBase64.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(base64, 'base64');
      if (buffer.byteLength === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Empty document' });
      }
      if (buffer.byteLength > MAX_BYTES) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'File exceeds 5MB' });
      }

      const ext = EXT[input.documentMimeType] ?? 'bin';
      const stamp = Date.now();
      const key = `knmc/${ctx.user.id}/${input.type}-${stamp}.${ext}`;
      await uploadFile(key, buffer, input.documentMimeType);

      const [row] = await ctx.db
        .insert(t)
        .values({
          userId: ctx.user.id,
          type: TYPE_ENUM[input.type],
          typeCode: input.type,
          registrationNumber: input.registrationNumber,
          documentR2Key: key,
          status: 'pending',
          statusCode: 'pending',
        })
        .onConflictDoUpdate({
          target: [t.userId, t.typeCode],
          targetWhere: isNull(t.deletedAt),
          set: {
            registrationNumber: input.registrationNumber,
            documentR2Key: key,
            status: 'pending',
            statusCode: 'pending',
            verifierNotes: null,
            aiExtractedData: {},
            updatedAt: new Date(),
          },
        })
        .returning({ id: t.id });

      if (!row) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      await aiQueue.add('verify_professional_registration', {
        registrationId: row.id,
        userId: ctx.user.id,
        type: input.type,
        registrationNumber: input.registrationNumber,
      });

      return { id: row.id, status: 'pending' as const };
    }),

  status: protectedProcedure
    .input(z.object({ type: z.enum(TYPE_CODES) }))
    .query(async ({ ctx, input }) => {
      const t = tables.professionalRegistrations;
      const [row] = await ctx.db
        .select({
          id: t.id,
          typeCode: t.typeCode,
          registrationNumber: t.registrationNumber,
          statusCode: t.statusCode,
          verifierNotes: t.verifierNotes,
          verifiedAt: t.verifiedAt,
        })
        .from(t)
        .where(and(eq(t.userId, ctx.user.id), eq(t.typeCode, input.type), isNull(t.deletedAt)))
        .limit(1);
      return row ?? null;
    }),

  myBadges: protectedProcedure.query(async ({ ctx }) => {
    const t = tables.professionalRegistrations;
    return ctx.db
      .select({
        typeCode: t.typeCode,
        registrationNumber: t.registrationNumber,
        statusCode: t.statusCode,
        verifiedAt: t.verifiedAt,
      })
      .from(t)
      .where(and(eq(t.userId, ctx.user.id), isNull(t.deletedAt)));
  }),
});
