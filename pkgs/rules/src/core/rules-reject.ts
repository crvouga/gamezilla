import type { Failure } from './types';

export class RulesReject extends Error {
  readonly failures: readonly Failure[];

  constructor(failures: readonly Failure[]) {
    super(failures.map((f) => f.code).join(', '));
    this.name = 'RulesReject';
    this.failures = failures;
  }
}

export function throwRulesReject(failures: readonly Failure[]): never {
  throw new RulesReject(failures);
}

export function isRulesReject(error: unknown): error is RulesReject {
  return error instanceof RulesReject;
}
