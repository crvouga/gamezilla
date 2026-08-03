import type { UploadRow } from '@pkgs/sync-engine/shared/upload-batch';

export type AuthzResult = { ok: true } | { ok: false; code: string };

export function ok(): AuthzResult {
  return { ok: true };
}

export function deny(code: string): AuthzResult {
  return { ok: false, code };
}

export function readRowString(
  row: UploadRow,
  column: string,
  camelKey?: string
): string | undefined {
  const raw =
    row.values?.[column] ??
    (camelKey !== undefined ? row.values?.[camelKey] : undefined);
  return typeof raw === 'string' ? raw : undefined;
}
