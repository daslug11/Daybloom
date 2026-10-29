/**
 * The ONE place that decides which model Daybloom uses. Every AI call —
 * features, Atlas chat and voice — imports MODEL from here. It is deliberately
 * not read from env vars or requests, so nothing can switch to a pricier model.
 */
export const MODEL = 'claude-haiku-5-5' as const;

/** USD per million tokens for claude-haiku-5-5 (prompts ≤ 100K tokens, which ours always are). */
export const PRICING = {
  input: 0.1,
  output: 0.5,
  cacheRead: 0.01, // 0.1× input
  cacheWrite: 0.125, // 1.25× input (5-minute cache)
} as const;

/** Low effort keeps thinking (billed as output) short; these are everyday assistant tasks. */
export const EFFORT = 'low' as const;

/** Hard caps on output per call (thinking counts toward these). */
export const MAX_TOKENS = {
  structured: 1200,
  atlas: 1000,
  atlasVoice: 500,
} as const;

/** Atlas: how much history to send and how many tool rounds one reply may take. */
export const ATLAS_HISTORY_MESSAGES = 8;
export const ATLAS_MAX_TOOL_ROUNDS = 6;

/** Per-user requests per rolling minute. */
export const RATE_LIMIT_PER_MINUTE = 5;

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export function estimateCost(u: TokenUsage): number {
  const cost =
    (u.input_tokens * PRICING.input +
      u.output_tokens * PRICING.output +
      (u.cache_read_input_tokens ?? 0) * PRICING.cacheRead +
      (u.cache_creation_input_tokens ?? 0) * PRICING.cacheWrite) /
    1_000_000;
  return Math.round(cost * 1e6) / 1e6;
}

export function addUsage(total: TokenUsage, u: TokenUsage): TokenUsage {
  return {
    input_tokens: total.input_tokens + u.input_tokens,
    output_tokens: total.output_tokens + u.output_tokens,
    cache_read_input_tokens: (total.cache_read_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
    cache_creation_input_tokens: (total.cache_creation_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
  };
}

export const ZERO_USAGE: TokenUsage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
