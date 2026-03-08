// lib/ai-pricing.ts
// Single source of truth for AI model pricing.

export const AI_PRICING = {
  'claude-sonnet-4-6': { input: 3.00, output: 15.00 },  // per MTok
  'claude-haiku-4-5': { input: 0.80, output: 4.00 },    // per MTok
} as const;

/**
 * Calculate cost in USD for a given model and token counts.
 * Returns 0 for unknown models.
 */
export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = AI_PRICING[model as keyof typeof AI_PRICING];
  if (!pricing) return 0;
  return (inputTokens * pricing.input / 1_000_000) + (outputTokens * pricing.output / 1_000_000);
}
