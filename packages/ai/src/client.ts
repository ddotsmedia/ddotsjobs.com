import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import {
  MAX_TOKENS,
  MODELS,
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
} from './enforce.js';

const apiKey = process.env.ANTHROPIC_API_KEY;
// Lazily constructed so importing this module never throws when the key is
// absent (e.g. during build). The first callAI() use validates it.
let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  _client ??= new Anthropic({ apiKey });
  return _client;
}

export interface CallAIOptions<T> {
  /** Task kind drives model tier (Haiku default, Sonnet for reasoning). */
  task: TaskKind;
  /** User-turn content. */
  prompt: string;
  /** Extra system instructions, appended after the Universal Prompt Law. */
  system?: string;
  /** When provided, the model output is parsed + validated against this. */
  schema?: z.ZodType<T>;
  /** Override max output tokens (defaults to the tier's MAX_TOKENS). */
  maxTokens?: number;
  /** Force a specific tier. NEVER Opus — type only allows haiku|sonnet. */
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

function extractText(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

function stripFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return (fenced?.[1] ?? text).trim();
}

/**
 * The ONLY entry point for Anthropic in the entire codebase. Enforces the
 * Universal Prompt Law, model-tier policy (never Opus), circuit breaker and
 * daily budget. Pass a Zod `schema` to get validated structured output.
 */
export async function callAI<T = string>(
  options: CallAIOptions<T>,
): Promise<CallAIResult<T>> {
  const tier: ModelTier = options.tier ?? pickModel(options.task);
  const model = MODELS[tier];
  const maxTokens = options.maxTokens ?? MAX_TOKENS[tier];
  const temperature = options.temperature ?? 0.2;

  const systemParts: string[] = [UNIVERSAL_PROMPT_LAW];
  if (options.system) systemParts.push(options.system);
  if (options.schema) systemParts.push(SCHEMA_INSTRUCTION);
  const system = systemParts.join('\n\n');

  await assertCircuitClosed();

  // Reserve budget on a rough projection (input estimated from char count / 4).
  const estInputTokens = Math.ceil((system.length + options.prompt.length) / 4);
  const projected = projectCostPaise(tier, estInputTokens, maxTokens);
  const dayKey = await reserveBudget(tier, projected);

  try {
    const message = await client().messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system,
      messages: [{ role: 'user', content: options.prompt }],
    });

    const usage = {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    };
    const costPaise = projectCostPaise(tier, usage.inputTokens, usage.outputTokens);
    await reconcileBudget(dayKey, projected, costPaise);
    await recordSuccess();

    const text = extractText(message);
    let data: T;
    if (options.schema) {
      const parsed: unknown = JSON.parse(stripFences(text));
      data = options.schema.parse(parsed);
    } else {
      data = text as unknown as T;
    }

    return { data, text, model, tier, costPaise, usage };
  } catch (err) {
    await recordFailure();
    throw err;
  }
}

export { MODELS, type ModelTier, type TaskKind };
