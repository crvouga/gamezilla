import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type {
  Mutation,
  MutationEnv,
  MutationRegistry,
} from '../../mutations/core/types';

type OwnMutation = {
  readonly id: string;
  readonly name: string;
  readonly args: string;
  readonly seq: number;
  readonly created_at: string;
  readonly status: string;
  readonly epoch: number;
  readonly acked_epoch: number | null;
};

type PeerMutation = {
  readonly id: string;
  readonly name: string;
  readonly args: string;
  readonly actor_id: string;
  readonly device_id: string;
  readonly account_id: string | null;
  readonly created_at: string;
  readonly epoch: number;
};

export type RebaseDeps = {
  readonly registry: MutationRegistry;
  readonly env: MutationEnv;
  readonly clientId: string;
};

async function runMutation(args: {
  readonly tx: SqlClient;
  readonly deps: RebaseDeps;
  readonly name: string;
  readonly argsJson: string;
  readonly env: MutationEnv;
  readonly changed: Set<string>;
}): Promise<void> {
  const m = args.deps.registry[args.name] as Mutation<unknown> | undefined;
  if (m === undefined) return;
  let parsed: unknown;
  try {
    parsed = m.args.parse(JSON.parse(args.argsJson));
  } catch {
    return;
  }
  try {
    await m.run({ tx: args.tx, env: args.env }, parsed);
    for (const t of m.writes) args.changed.add(t);
  } catch {
    // Keep queued; hide optimistic effect.
  }
}

async function loadOwnForRebase(
  tx: SqlClient,
  clientId: string,
  basisEpoch: number
): Promise<readonly OwnMutation[]> {
  return tx.query(sql<OwnMutation>`
    SELECT id, name, args, seq, created_at, status, epoch, acked_epoch
    FROM _mutations
    WHERE client_id = ${clientId}
      AND (
        status = ${'pending'}
        OR (
          status = ${'uploaded'}
          AND acked_epoch IS NOT NULL
          AND acked_epoch > ${basisEpoch}
        )
      )
    ORDER BY seq ASC
  `);
}

async function loadPeersForRebase(
  tx: SqlClient,
  basisEpoch: number
): Promise<readonly PeerMutation[]> {
  return tx.query(sql<PeerMutation>`
    SELECT id, name, args, actor_id, device_id, account_id, created_at, epoch
    FROM _peer_mutations
    WHERE epoch >= ${basisEpoch}
    ORDER BY epoch ASC, seq ASC
  `);
}

/** Re-apply unconfirmed own + peer optimistic mutations after a server merge. */
export async function rebaseUnconfirmed(
  tx: SqlClient,
  deps: RebaseDeps,
  basisEpoch: number,
  changed: Set<string>
): Promise<void> {
  const own = await loadOwnForRebase(tx, deps.clientId, basisEpoch);
  for (const row of own) {
    await runMutation({
      tx,
      deps,
      name: row.name,
      argsJson: row.args,
      env: { ...deps.env, now: () => new Date(row.created_at) },
      changed,
    });
  }
  const peers = await loadPeersForRebase(tx, basisEpoch);
  for (const row of peers) {
    await runMutation({
      tx,
      deps,
      name: row.name,
      argsJson: row.args,
      env: {
        actorId: row.actor_id,
        deviceId: row.device_id,
        accountId: row.account_id,
        isAnon: row.account_id === null,
        now: () => new Date(row.created_at),
      },
      changed,
    });
  }
}

/** Drop optimistic log rows that a post-ack / post-peer query has confirmed. */
export async function confirmOptimistic(
  tx: SqlClient,
  clientId: string,
  basisEpoch: number
): Promise<void> {
  await tx.run(sql`
    DELETE FROM _mutations
    WHERE client_id = ${clientId}
      AND status = ${'uploaded'}
      AND acked_epoch IS NOT NULL
      AND acked_epoch <= ${basisEpoch}
  `);
  await tx.run(sql`
    DELETE FROM _peer_mutations WHERE epoch < ${basisEpoch}
  `);
}
