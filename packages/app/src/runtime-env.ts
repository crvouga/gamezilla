/**
 * Bun/Node {@link process.env} is typed with a string index signature. With
 * `noPropertyAccessFromIndexSignature`, use this narrowed shape for dot access.
 */
export interface AppRuntimeEnv {
  readonly PORT?: string;
  readonly DATABASE_URL?: string;
  readonly DATABASE_HOST?: string;
  readonly DATABASE_USERNAME?: string;
  readonly DATABASE_PASSWORD?: string;
  readonly DATABASE_PORT?: string;
  readonly DATABASE_NAME?: string;
}

export function getRuntimeEnv(): AppRuntimeEnv {
  return process.env as AppRuntimeEnv;
}
