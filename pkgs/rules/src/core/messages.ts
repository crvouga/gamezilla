import type { Failure } from './types';

export type FailureMessageMap = Readonly<
  Record<string, string | ((failure: Failure) => string)>
>;

export function messageForFailure(
  failure: Failure,
  messages: FailureMessageMap
): string {
  const entry = messages[failure.code];
  if (entry === undefined) {
    return failure.code;
  }
  return typeof entry === 'function' ? entry(failure) : entry;
}
