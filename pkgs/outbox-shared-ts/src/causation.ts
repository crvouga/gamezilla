import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';

const CAUSATION = Symbol('outbox-causation');
type CausalTransaction = SqlTx & { readonly [CAUSATION]?: string };

/** Transaction-local context, carried by a handle rather than shared mutable state. */
export function withOutboxCausation(
  tx: SqlTx,
  causationId: string | null
): SqlTx {
  if (causationId === null) return tx;
  const scoped: CausalTransaction = {
    query: (query) => tx.query(query),
    run: (query) => tx.run(query),
    [CAUSATION]: causationId,
  };
  return scoped;
}

export function outboxCausation(tx: SqlTx): string | null {
  return (tx as CausalTransaction)[CAUSATION] ?? null;
}
