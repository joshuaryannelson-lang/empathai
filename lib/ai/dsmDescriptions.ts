// lib/ai/dsmDescriptions.ts
// Maps ICD-10/DSM-5 codes to plain-language clinical descriptions.
// Used ONLY for prompt construction — never displayed to patients or stored in audit logs.
// Raw codes are NEVER sent to the LLM; only these descriptions enter the prompt.

const DSM_DESCRIPTIONS: Record<string, string> = {
  // Depressive disorders
  "F32.0": "mild depressive episode",
  "F32.1": "moderate depressive episode",
  "F32.2": "severe depressive episode without psychotic features",
  "F32.9": "depressive episode, unspecified",
  "F33.0": "recurrent depressive disorder, current episode mild",
  "F33.1": "recurrent depressive disorder, current episode moderate",
  "F33.2": "recurrent depressive disorder, current episode severe",
  "F34.1": "persistent depressive disorder (dysthymia)",

  // Anxiety disorders
  "F40.10": "social phobia",
  "F41.0": "panic disorder",
  "F41.1": "generalized anxiety",
  "F41.9": "anxiety, unspecified",

  // OCD and related
  "F42.2": "mixed obsessional thoughts and compulsive acts",
  "F42.9": "obsessive-compulsive concerns",

  // Trauma and stress-related
  "F43.0": "acute stress reaction",
  "F43.1": "post-traumatic stress",
  "F43.10": "post-traumatic stress, unspecified",
  "F43.2": "adjustment disorder",
  "F43.21": "adjustment disorder with depressed mood",
  "F43.22": "adjustment disorder with anxiety",
  "F43.23": "adjustment disorder with mixed anxiety and depressed mood",
  "F43.25": "adjustment disorder with mixed disturbance of emotions and conduct",

  // Eating disorders
  "F50.0": "restrictive eating patterns",
  "F50.00": "restrictive eating patterns",
  "F50.01": "restrictive eating with binge-purge features",
  "F50.02": "restrictive eating in partial remission",
  "F50.2": "binge-purge eating patterns",
  "F50.9": "eating concerns, unspecified",

  // Personality disorders
  "F60.3": "emotional dysregulation and interpersonal instability",
  "F60.5": "obsessive-compulsive personality features",

  // ADHD
  "F90.0": "attention and focus difficulties, predominantly inattentive",
  "F90.1": "attention and focus difficulties, predominantly hyperactive-impulsive",
  "F90.2": "attention and focus difficulties, combined presentation",
  "F90.9": "attention and focus difficulties, unspecified",

  // Bipolar and related
  "F31.0": "mood instability, current hypomanic episode",
  "F31.3": "mood instability, current mild-moderate depressive episode",
  "F31.9": "mood instability, unspecified",

  // Substance-related
  "F10.10": "alcohol-related concerns, mild",
  "F10.20": "alcohol-related concerns, moderate-severe",

  // Sleep-wake
  "F51.01": "primary insomnia",
  "F51.09": "insomnia, unspecified",

  // Dissociative
  "F44.0": "dissociative amnesia",
  "F44.81": "dissociative identity features",

  // Somatic
  "F45.1": "somatic concern disorder",
};

/**
 * Translates a DSM/ICD code to a plain-language clinical description
 * suitable for inclusion in a prompt. Returns undefined for unknown codes.
 * NEVER returns the raw code — only descriptive language.
 */
export function describeDsmCode(code: string): string | undefined {
  return DSM_DESCRIPTIONS[code.toUpperCase()] ?? DSM_DESCRIPTIONS[code];
}

/**
 * Translates an array of DSM codes to plain descriptions.
 * Unknown codes are silently dropped — they never reach the prompt.
 */
export function describeDsmCodes(codes: string[]): string[] {
  return codes
    .map(c => describeDsmCode(c))
    .filter((d): d is string => d !== undefined);
}
