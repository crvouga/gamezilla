import type { WritePolicyDecision } from '@pkgs/sync-engine/server/upload-handler';
import type { UploadRow } from '@pkgs/sync-engine/shared/upload-batch';

export function allow(): WritePolicyDecision {
  return { allowed: true };
}

export function deny(reason: string): WritePolicyDecision {
  return { allowed: false, reason };
}

export function readRowString(
  row: UploadRow,
  column: string
): string | undefined {
  const raw = row.values?.[column];
  return typeof raw === 'string' ? raw : undefined;
}

export function readRowStringArray(
  row: UploadRow,
  column: string
): readonly string[] {
  const raw = row.values?.[column];
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === 'string');
}

export function requireSignedIn(
  accountId: string | null,
  label: string
): WritePolicyDecision | null {
  if (accountId === null) {
    return deny(`${label} requires sign-in`);
  }
  return null;
}

export function ownerMatches(
  owner: string | undefined,
  myId: string
): WritePolicyDecision | null {
  if (owner !== undefined && owner !== myId) {
    return deny('owner_id mismatch');
  }
  return null;
}

export function idMatches(
  id: string,
  expected: string,
  label: string
): WritePolicyDecision | null {
  if (id !== expected) {
    return deny(`${label} id mismatch`);
  }
  return null;
}
