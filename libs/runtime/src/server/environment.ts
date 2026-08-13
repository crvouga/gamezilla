/**
 * Prod binding addresses — same keys as {@link ../dst/provide.ts} `dstProvide`.
 * Values are resolved at app composition roots (Worker env, Neon, EMQX, etc.).
 */
export const environment = {
  db: 'DATABASE_URL',
  events: 'EMQX_*',
  'api.kv': 'KvImplPostgres',
  'api.media': 'S3/B2 ObjectStore',
  'api.payments': 'STRIPE_*',
  'api.tts': 'ELEVENLABS_*',
  'api.llm': 'OPENAI_*',
  'api.google': 'GOOGLE_OAUTH_*',
  'client.db': 'expo-sqlite / OPFS (per user)',
  'client.kv': 'KvPlatform (localStorage / AsyncStorage)',
  'client.sentry': 'client_config.sentryDsn',
  'room.storage': '@apps/room Durable Object storage',
  'room:*.storage': '@apps/room DO storage (keyed by topic)',
} as const;

export type EnvironmentAddress = keyof typeof environment;
