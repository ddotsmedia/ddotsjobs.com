import { callAI } from '@ddotsjobs/ai';
import { gulfTranslateTitlePrompt } from '@ddotsjobs/ai/prompts';
import { and, db, eq, isNull, tables } from '@ddotsjobs/db';
import { queues } from '../queues.js';

export interface GulfTranslateJob {
  workHistoryId: string;
  userId: string;
  gulfTitle: string;
  country: string | null;
  industry: string | null;
  yearsExp: number | null;
}

const LOOKUP_CONFIDENCE = 0.8;

export async function runGulfTranslate(raw: unknown): Promise<{ status: string }> {
  const data = raw as GulfTranslateJob;
  if (!data?.workHistoryId || !data?.gulfTitle) return { status: 'skipped' };

  const normalized = data.gulfTitle.trim().toLowerCase();
  const gt = tables.gulfTitleTranslations;

  // 1. lookup cache
  const [cached] = await db
    .select({ kerala: gt.keralaEquivalents, confidence: gt.confidenceScore })
    .from(gt)
    .where(and(eq(gt.gulfTitleNormalized, normalized), isNull(gt.deletedAt)))
    .limit(1);

  let keralaTitles: string[];
  let confidence: number;
  let source: string;

  if (cached && (cached.confidence ?? 0) >= LOOKUP_CONFIDENCE && cached.kerala.length > 0) {
    keralaTitles = cached.kerala;
    confidence = cached.confidence ?? LOOKUP_CONFIDENCE;
    source = 'lookup';
  } else {
    // 2. AI translate
    const spec = gulfTranslateTitlePrompt({
      gulfTitle: data.gulfTitle,
      country: data.country,
      industry: data.industry,
      yearsExp: data.yearsExp,
    });
    const { data: out } = await callAI({
      task: spec.task,
      prompt: spec.prompt,
      system: spec.system,
      schema: spec.schema,
    });
    keralaTitles = out.kerala_titles;
    confidence = out.confidence;
    source = 'ai';

    // 3. cache (ON CONFLICT DO NOTHING on normalized title)
    await db
      .insert(gt)
      .values({
        sourceTitle: data.gulfTitle,
        gulfTitle: data.gulfTitle,
        gulfTitleNormalized: normalized,
        keralaEquivalents: keralaTitles,
        canonicalTitleEn: out.primary_title,
        canonicalTitleMl: out.explanation_ml,
        categorySlug: out.suggested_categories[0] ?? null,
        industry: data.industry,
        confidenceScore: confidence,
        translationSource: 'ai',
      })
      .onConflictDoNothing({ target: gt.gulfTitleNormalized });
  }

  // 4. update work history
  await db
    .update(tables.pravasiWorkHistory)
    .set({
      translatedKeralaTitles: keralaTitles,
      translationConfidence: confidence,
      translationSource: source,
    })
    .where(eq(tables.pravasiWorkHistory.id, data.workHistoryId));

  // 5. recompute fit scores for this user (consumer arrives in C5)
  await queues.ai.add('fit.recompute', { userId: data.userId });

  return { status: source };
}
