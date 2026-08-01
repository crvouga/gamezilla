import type { Failure } from './types';

export type FailOpts = {
  readonly table?: string;
  readonly id?: string;
  readonly params?: Readonly<Record<string, unknown>>;
};

export function fail(code: string, opts?: FailOpts): Failure {
  if (opts === undefined) {
    return { code };
  }
  return {
    code,
    ...(opts.table !== undefined ? { table: opts.table } : {}),
    ...(opts.id !== undefined ? { id: opts.id } : {}),
    ...(opts.params !== undefined ? { params: opts.params } : {}),
  };
}
