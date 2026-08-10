/**
 * Mirrors `GET /api/features` from the API Worker. Keep fields in sync with
 * `apps/api/src/features/api-features.ts`.
 */
export type ApiFeatures = {
  readonly google: boolean;
  readonly emailPassword: boolean;
  readonly stripe: boolean;
  readonly tts: boolean;
  readonly llm: boolean;
};

export const DEFAULT_API_FEATURES: ApiFeatures = {
  google: false,
  emailPassword: false,
  stripe: false,
  tts: false,
  llm: false,
};

export function parseApiFeatures(raw: unknown): ApiFeatures | null {
  if (raw === null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (
    typeof o['google'] !== 'boolean' ||
    typeof o['emailPassword'] !== 'boolean' ||
    typeof o['stripe'] !== 'boolean' ||
    typeof o['tts'] !== 'boolean' ||
    typeof o['llm'] !== 'boolean'
  ) {
    return null;
  }
  return {
    google: o['google'],
    emailPassword: o['emailPassword'],
    stripe: o['stripe'],
    tts: o['tts'],
    llm: o['llm'],
  };
}
