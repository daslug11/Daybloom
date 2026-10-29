import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

/** Reads ANTHROPIC_API_KEY from the environment (never sent to the browser). */
export function anthropic(): Anthropic {
  client ??= new Anthropic({ maxRetries: 1, timeout: 60_000 });
  return client;
}
