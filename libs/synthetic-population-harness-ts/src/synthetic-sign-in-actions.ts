/**
 * A Synthetic User signing in the only way one can: an emailed link, read
 * from its internal inbox by the worker that holds its lease.
 */

import { actorUi, pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import {
  hostSyntheticUser,
  requestEmailLink,
  signInWithEmailLink,
} from '@libs/harness-ts/email-link-actions';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { signedInAccountOf } from '@libs/harness-ts/identity';
import type { Lease } from '@libs/synthetic-population-server-ts/records';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { fixtureWorkerRpc } from './fixture-worker-rpc';

export type SyntheticUserSignIn = {
  /** The worker's lease on the Synthetic User: what lets it read the mail. */
  readonly lease: Lease;
  /** The Synthetic User's provisioned address. */
  readonly email: string;
};

/** The actor whose device is the named Synthetic User's application host. */
export function syntheticUserActor(name: string): string {
  return name.toLowerCase();
}

/**
 * What the named Synthetic User's worker holds right now: its lease and the
 * user's address. Throws when no worker is running the user.
 */
export async function syntheticUserSignIn(
  s: ProductHarness,
  name: string
): Promise<SyntheticUserSignIn> {
  const rows = await s.harness.serverSql.sqlClient.query(sql<{
    id: string;
    email: string;
    worker_id: string | null;
    generation: number;
    lease_until: string | Date | null;
  }>`
    SELECT id, email, worker_id, generation, lease_until FROM population_users
    WHERE username = ${name} AND deleted_at IS NULL`);
  const row = rows[0];
  if (row === undefined || row.worker_id === null || row.lease_until === null)
    throw new Error(`No worker is running the Synthetic User ${name}`);
  return {
    email: row.email,
    lease: {
      userId: row.id,
      workerId: row.worker_id,
      generation: Number(row.generation),
      expiresAt: new Date(row.lease_until).toISOString(),
    },
  };
}

/** Whether a Synthetic User was provisioned with this address. */
export async function syntheticUserHasAddress(
  s: ProductHarness,
  email: string
): Promise<boolean> {
  const rows = await s.harness.serverSql.sqlClient.query(sql<{ id: string }>`
    SELECT id FROM population_users
    WHERE email = ${email.trim().toLowerCase()} AND deleted_at IS NULL`);
  return rows.length > 0;
}

/**
 * How many sign-in links wait, untaken, in the Synthetic Population's
 * internal inbox for an address. Looking does not take them.
 */
export async function signInLinksWaitingFor(
  s: ProductHarness,
  email: string
): Promise<number> {
  const rows = await s.harness.serverSql.sqlClient.query(sql<{ id: string }>`
    SELECT id FROM population_sign_in_mail
    WHERE email = ${email.trim().toLowerCase()}
      AND link IS NOT NULL AND deleted_at IS NULL`);
  return rows.length;
}

/** Every address the internal inbox has ever kept mail for. */
export async function signInMailAddresses(
  s: ProductHarness
): Promise<readonly string[]> {
  const rows = await s.harness.serverSql.sqlClient.query(
    sql<{
      email: string;
    }>`SELECT DISTINCT email FROM population_sign_in_mail ORDER BY email`
  );
  return rows.map((row) => row.email);
}

function ownership(lease: Lease) {
  return {
    userId: lease.userId,
    workerId: lease.workerId,
    generation: lease.generation,
  };
}

/**
 * The newest sign-in link in the leased Synthetic User's internal inbox,
 * taken through the actual worker RPC: handed out once, then gone. `null`
 * when no mail waits, or when the lease does not own the user.
 */
export async function takeSyntheticUserSignInLink(
  s: ProductHarness,
  lease: Lease
): Promise<string | null> {
  const client = await fixtureWorkerRpc(s);
  const response = await client['take-sign-in-link'].$post({
    json: ownership(lease),
  });
  if (response.status !== 200) return null;
  return (await response.json()).link;
}

/** The actor's device becomes the Synthetic User's application host. */
export const givenSyntheticUserDevice = scenarioAction({
  name: 'givenSyntheticUserDevice',
  act: async (s, actor: string) => {
    await Promise.resolve(hostSyntheticUser.act(s, actor));
    await actorUi(s, actor);
  },
});

/** Ask for a sign-in link to the Synthetic User's address, through the UI. */
export const requestSyntheticUserSignInLink = scenarioAction({
  name: 'requestSyntheticUserSignInLink',
  act: async (s, actor: string, email: string) => {
    await Promise.resolve(requestEmailLink.act(s, actor, email));
  },
});

/**
 * The whole sign-in on the Synthetic User's own device: ask for the link,
 * take it from the internal inbox, paste it, and wait for the account.
 */
export const signInSyntheticUser = scenarioAction({
  name: 'signInSyntheticUser',
  act: async (s, actor: string, user: SyntheticUserSignIn) => {
    await Promise.resolve(requestEmailLink.act(s, actor, user.email));
    const link = await takeSyntheticUserSignInLink(s, user.lease);
    if (link === null)
      throw new Error('No sign-in link reached the internal inbox');
    await Promise.resolve(signInWithEmailLink.act(s, actor, link));
    await pollUntil(
      s,
      async () => (await signedInAccountOf(s, actor)) ?? null,
      { maxMs: 20_000, description: "the Synthetic User's account is ready" }
    );
  },
});
