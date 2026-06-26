// Central model + budget config. Single source of truth for AI tier selection.
// Rule: Haiku default. Sonnet for reasoning. NEVER Opus.

export const MODELS = {
  /** Default tier — fast, cheap. Classification, extraction, translation, short gen. */
  haiku: 'claude-haiku-4-5-20251001',
  /** Reasoning tier — fit scoring, multi-step analysis, structured judgement. */
  sonnet: 'claude-sonnet-4-6',
} as const;

export type ModelTier = keyof typeof MODELS;
export type ModelId = (typeof MODELS)[ModelTier];

// Active provider: Gemini (Anthropic kept above for reference). The default tier
// maps to Flash, the reasoning tier to Pro. (Gemini 1.5 was retired by Google;
// 2.5 is the current stable generation.)
export const GEMINI_MODELS = {
  flash: 'gemini-2.5-flash',
  pro: 'gemini-2.5-pro',
} as const;

const TIER_TO_GEMINI: Record<ModelTier, string> = {
  haiku: GEMINI_MODELS.flash,
  sonnet: GEMINI_MODELS.pro,
};

/** Concrete Gemini model id for a tier. */
export function geminiModelForTier(tier: ModelTier): string {
  return TIER_TO_GEMINI[tier];
}

/** Per-tier max output tokens. Keep tight — long outputs are slow + costly. */
export const MAX_TOKENS: Record<ModelTier, number> = {
  haiku: 1024,
  sonnet: 4096,
};

/**
 * Hard per-call cost ceiling in paise (integer). callAI() refuses to dispatch a
 * request whose projected cost exceeds this. Projected on input+output token est.
 */
export const COST_CEILING: Record<ModelTier, number> = {
  haiku: 500, // ₹5.00
  sonnet: 5000, // ₹50.00
};

/** Approx cost per 1M tokens in paise (input, output). Tune from billing data. */
export const TOKEN_COST: Record<ModelTier, { input: number; output: number }> = {
  haiku: { input: 8000, output: 40000 }, // ₹80 / ₹400 per 1M
  sonnet: { input: 24000, output: 120000 }, // ₹240 / ₹1200 per 1M
};

export type TaskKind =
  | 'classify'
  | 'extract'
  | 'translate'
  | 'summarize'
  | 'fit_score'
  | 'reasoning';

/** Map a task to its model tier. Only `fit_score` / `reasoning` escalate to Sonnet. */
export function pickModel(task: TaskKind): ModelTier {
  switch (task) {
    case 'fit_score':
    case 'reasoning':
      return 'sonnet';
    case 'classify':
    case 'extract':
    case 'translate':
    case 'summarize':
    default:
      return 'haiku';
  }
}

/** Projected cost in paise for a call, given token counts. */
export function projectCostPaise(
  tier: ModelTier,
  inputTokens: number,
  outputTokens: number,
): number {
  const c = TOKEN_COST[tier];
  return Math.ceil((inputTokens * c.input + outputTokens * c.output) / 1_000_000);
}
