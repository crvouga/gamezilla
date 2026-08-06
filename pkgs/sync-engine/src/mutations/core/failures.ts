import { ZodError } from 'zod';

import { MutationError, type MutationFailure } from './types';

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

export function zodFailures(
  e: ZodError,
  mutationName: string
): MutationFailure[] {
  return e.issues.map((issue) => ({
    rule: mutationName,
    code: 'INVALID_ARGS',
    message: issue.message,
    meta: { path: issue.path },
  }));
}

export function isMutationError(e: unknown): e is MutationError {
  return e instanceof MutationError;
}

export function isZodError(e: unknown): e is ZodError {
  return e instanceof ZodError;
}
