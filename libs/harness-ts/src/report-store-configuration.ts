const REPORTS_ENV = [
  'REPORTS_BUCKET',
  'REPORTS_ENDPOINT',
  'REPORTS_WRITE_ACCESS_KEY_ID',
  'REPORTS_WRITE_SECRET_ACCESS_KEY',
] as const;

/** No store is optional; partial credentials must still fail validation. */
export function reportsStoreUnconfigured(
  env: Readonly<Record<string, string | undefined>>
): boolean {
  return REPORTS_ENV.every((name) => (env[name]?.trim() ?? '') === '');
}
