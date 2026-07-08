/**
 * Worker bindings required by @apps/api boot but managed manually in Infisical
 * (see `EXTERNALLY_MANAGED_KEYS` in `resources/secrets.ts`; not in
 * {@link getSecretMap}).
 *
 * Keep aligned with `apps/api/src/config/secret-names.ts` and the TTS/LLM
 * binding helpers in `@pkgs/tts` / `@pkgs/llm`.
 */
export const API_WORKER_EXTERNALLY_MANAGED_SECRET_KEYS = [
  'ELEVEN_LABS_API_KEY',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
] as const satisfies readonly string[];
