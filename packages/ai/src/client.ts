import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import {
  MAX_TOKENS,
  MODELS,
  geminiModelForTier,
  pickModel,
  projectCostPaise,
  type ModelTier,
  type TaskKind,
} from '@ddotsjobs/config/models';
import { UNIVERSAL_PROMPT_LAW } from '@ddotsjobs/config/universal-prompt-law';
import {
  assertCircuitClosed,
  reconcileBudget,
  recordFailure,
  recordSuccess,
  reserveBudget,
  trackUsage,
} from './enforce.js';

const apiKey = process.env.GEMINI_API_KEY;
// Lazily constructed so importing this module never throws when the key is
// absent (e.g. during build). The first callAI() use validates it.
let _client: GoogleGenerativeAI | null = null;
function client(): GoogleGenerativeAI {
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  _client ??= new GoogleGenerativeAI(apiKey);
  return _client;
}

export interface CallAIOptions<T> {
  /** Task kind drives model tier (flash default, pro for reasoning). */
  task: TaskKind;
  /** User-turn content. */
  prompt: string;
  /** Extra system instructions, appended after the Universal Prompt Law. */
  system?: string;
  /** When provided, the model output is parsed + validated against this. */
  schema?: z.ZodType<T>;
  /** Override max output tokens (defaults to the tier's MAX_TOKENS). */
  maxTokens?: number;
  /** Force a specific tier. */
  tier?: ModelTier;
  /** Lower = more deterministic. Default 0.2. */
  temperature?: number;
}

export interface CallAIResult<T> {
  /** Validated data when a schema was supplied; otherwise the raw string. */
  data: T;
  text: string;
  model: string;
  tier: ModelTier;
  costPaise: number;
  usage: { inputTokens: number; outputTokens: number };
}

const SCHEMA_INSTRUCTION =
  'Respond with ONLY a single JSON value matching the requested schema. ' +
  'No markdown fences, no commentary.';

function stripFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return (fenced?.[1] ?? text).trim();
}

/**
 * The ONLY AI entry point in the entire codebase. Enforces the Universal Prompt
 * Law, model-tier policy, circuit breaker and daily budget. Backed by Gemini
 * (Flash for the default tier, Pro for reasoning). Pass a Zod `schema` to get
 * validated structured output.
 */
export async function callAI<T = string>(
  options: CallAIOptions<T>,
): Promise<CallAIResult<T>> {
  const tier: ModelTier = options.tier ?? pickModel(options.task);
  const modelName = geminiModelForTier(tier);
  const maxTokens = options.maxTokens ?? MAX_TOKENS[tier];
  const temperature = options.temperature ?? 0.2;

  const systemParts: string[] = [UNIVERSAL_PROMPT_LAW];
  if (options.system) systemParts.push(options.system);
  if (options.schema) systemParts.push(SCHEMA_INSTRUCTION);
  const system = systemParts.join('\n\n');
  const fullPrompt = `${system}\n\n${options.prompt}`;

  await assertCircuitClosed();

  // Reserve budget on a rough projection (input estimated from char count / 4).
  const estInputTokens = Math.ceil(fullPrompt.length / 4);
  const projected = projectCostPaise(tier, estInputTokens, maxTokens);
  const dayKey = await reserveBudget(tier, projected);

  try {
    const model = client().getGenerativeModel({
      model: modelName,
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    });
    const result = await model.generateContent(fullPrompt);
    const text = result.response.text().trim();
    if (!text) throw new Error('Empty response from model');

    // Gemini does not return billed token usage here — estimate from char count.
    const usage = {
      inputTokens: estInputTokens,
      outputTokens: Math.ceil(text.length / 4),
    };
    const costPaise = projectCostPaise(tier, usage.inputTokens, usage.outputTokens);
    await reconcileBudget(dayKey, projected, costPaise);
    await recordSuccess();
    // Daily USD tracking for the budget cron (≈₹83/$ — order-of-magnitude).
    await trackUsage(costPaise / 100 / 83);

    let data: T;
    if (options.schema) {
      const parsed: unknown = JSON.parse(stripFences(text));
      data = options.schema.parse(parsed);
    } else {
      data = text as unknown as T;
    }

    return { data, text, model: modelName, tier, costPaise, usage };
  } catch (err) {
    await recordFailure();
    throw err;
  }
}

export { MODELS, type ModelTier, type TaskKind };
