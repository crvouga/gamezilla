import type { Session } from '@pkgs/harness-root-shared-ts/runtime-types';
import type { HarnessSql } from './sql-types';

export function sessionSeed(session: Session): bigint {
  const rng = session.ports.rng as {
    readonly _seeded?: { readonly seed: bigint };
  };
  return rng._seeded?.seed ?? 1n;
}

export function sessionSql(session: Session): HarnessSql | undefined {
  return (session.ports as { readonly sql?: HarnessSql }).sql;
}
