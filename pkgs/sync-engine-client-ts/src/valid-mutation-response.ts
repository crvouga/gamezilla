import type {
  MutationUploadResult,
  MutationUploadRow,
} from './mutation-upload-queue';

/** A complete, unambiguous acknowledgement is required before retiring work. */
export function validMutationResponse(
  value: unknown,
  mutations: readonly MutationUploadRow[]
): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const result = value as Partial<MutationUploadResult>;
  if (
    result.ok !== true ||
    !Number.isFinite(result.serverTimeMs) ||
    !Number.isSafeInteger(result.ackSeq) ||
    (result.ackSeq ?? -1) < 0 ||
    !Array.isArray(result.verdicts) ||
    result.verdicts.length !== mutations.length
  )
    return false;
  const pending = new Set(mutations.map((row) => row.id));
  return result.verdicts.every((verdict) => {
    if (
      typeof verdict !== 'object' ||
      verdict === null ||
      !pending.delete(verdict.mutationId)
    )
      return false;
    return (
      verdict.status === 'applied' ||
      (verdict.status === 'rejected' &&
        typeof verdict.code === 'string' &&
        typeof verdict.message === 'string')
    );
  });
}
