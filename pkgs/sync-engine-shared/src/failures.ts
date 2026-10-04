import { MutationError } from './mutations-types';
import type { MutationFailure } from './mutations-types';

export function mutationErrorToFailure(
  e: MutationError,
  mutationName: string
): MutationFailure {
  return {
    rule: mutationName,
    code: e.code,
    message: e.message,
    ...(e.meta !== undefined ? { meta: e.meta } : {}),
  };
}

export function isMutationError(e: unknown): e is MutationError {
  return e instanceof MutationError;
}
