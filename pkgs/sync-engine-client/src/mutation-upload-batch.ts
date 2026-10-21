import {
  MAX_MUTATIONS_BODY_BYTES,
  type MutationRequestItem,
  type MutationVerdict,
  PAYLOAD_TOO_LARGE,
} from '@pkgs/sync-engine-shared/v2';

const encoder = new TextEncoder();
const byteLength = (text: string) => encoder.encode(text).byteLength;

/**
 * The longest prefix of `rows` whose `{ mutations }` upload body fits the
 * byte cap, in queue order. Empty when the first row alone is over the cap.
 */
export function fitUploadBatch(
  rows: readonly MutationRequestItem[],
  maxBytes: number = MAX_MUTATIONS_BODY_BYTES
): readonly MutationRequestItem[] {
  let bytes = byteLength(JSON.stringify({ mutations: [] }));
  let count = 0;
  for (const row of rows) {
    bytes += byteLength(JSON.stringify(row)) + (count > 0 ? 1 : 0);
    if (bytes > maxBytes) break;
    count += 1;
  }
  return rows.slice(0, count);
}

/** The refusal recorded for a write no upload can carry. */
export function oversizedVerdict(
  mutationId: string,
  maxBytes: number = MAX_MUTATIONS_BODY_BYTES
): Extract<MutationVerdict, { status: 'rejected' }> {
  return {
    mutationId,
    status: 'rejected',
    code: PAYLOAD_TOO_LARGE,
    message: `This change is larger than the ${maxBytes}-byte upload limit`,
  };
}
