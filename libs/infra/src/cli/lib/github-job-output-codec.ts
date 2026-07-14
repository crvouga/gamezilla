/**
 * Encode/decode values written to GitHub Actions job outputs.
 *
 * Infisical/secrets-action registers every fetched secret via `core.setSecret`.
 * GHA then skips any job output whose value contains a registered secret as a
 * substring (`Skip output '…' since it may contain secret`). Public URLs
 * (`API_URL`) and random UUIDs (`lock_id` overlapping hex account ids) both
 * trip this. Hex-encoding the UTF-8 bytes breaks those literal substring
 * matches so cross-job outputs still flow.
 */
export function encodeGithubJobOutputValue(value: string): string {
  return Buffer.from(value, 'utf8').toString('hex');
}

export function decodeGithubJobOutputValue(encoded: string): string {
  const trimmed = encoded.trim();
  if (trimmed.length === 0) return '';
  if (!/^[0-9a-fA-F]+$/.test(trimmed) || trimmed.length % 2 !== 0) {
    // Backward-compatible: plain values from older runs / local.
    return trimmed;
  }
  return Buffer.from(trimmed, 'hex').toString('utf8');
}
