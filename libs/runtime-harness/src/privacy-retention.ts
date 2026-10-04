import {
  confirmDeletion,
  privacyTimePasses,
  proveAccount,
} from '@libs/account-privacy-harness/privacy-actions';
import { scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { signedInAccountOf } from '@libs/harness/identity';
import {
  openProfileEdit,
  setUsername,
} from '@libs/profile-harness/profile-actions';
import { profileVisibleToPeople } from '@libs/profile-harness/profile-visibility';
import sql from '@pkgs/sql-shared/sql';
import { AppRecovery } from '@libs/runtime-server/app-recovery';
import { InvestigationTrails } from '@libs/runtime-server/investigation-trails';

const recovery = (s: ProductHarness) =>
  new AppRecovery(s.harness.serverSql.sqlClient, {
    clock: s.harness.clock,
    createId: s.session.ports.createId,
    objectStore: s.harness.server.blob,
    rooms: s.harness.roomNode.services,
  });
const trails = (s: ProductHarness) =>
  new InvestigationTrails({
    clock: s.harness.clock,
    objectStore: s.harness.server.blob,
  });
export const prepareRecoveryCopy = scenarioAction({
  name: 'prepareRecoveryCopy',
  act: async (s, actor: string, deleted: boolean) => {
    await Promise.resolve(proveAccount.act(s, actor));
    await Promise.resolve(openProfileEdit.act(s, actor));
    await Promise.resolve(setUsername.act(s, actor, `saved_${actor}`));
    s.probes.recoveryAccountId = await signedInAccountOf(s, actor);
    await recovery(s).save('before-trouble');
    if (deleted) {
      await Promise.resolve(confirmDeletion.act(s, actor));
      await Promise.resolve(privacyTimePasses.act(s, 30 * 86_400_000));
    } else {
      await s.harness.serverSql.sqlClient.run(
        sql`UPDATE profile SET username = ${'lost'} WHERE id = ${s.probes.recoveryAccountId}`
      );
    }
  },
});
export const recoverApp = scenarioAction({
  name: 'recoverApp',
  act: async (s) => {
    await recovery(s).recover('before-trouble');
  },
});
export const recordTrail = scenarioAction({
  name: 'recordTrail',
  act: async (s, actor: string, days: number) => {
    await trails(s).record(actor, { event: 'opened the app', person: actor });
    await Promise.resolve(privacyTimePasses.act(s, days * 86_400_000));
  },
});
export const followTrail = scenarioAction({
  name: 'followTrail',
  act: async (s, actor: string) => {
    s.probes.investigationTrail = await trails(s).follow(actor);
  },
});
export const trailRead = (s: ProductHarness) => s.probes.investigationTrail;
export async function recoveredPersonalData(s: ProductHarness, actor: string) {
  const account = await signedInAccountOf(s, actor);
  return account === null ? null : await profileVisibleToPeople(s, account);
}

export async function recoveredAccountProfile(s: ProductHarness) {
  const accountId = s.probes.recoveryAccountId;
  if (typeof accountId !== 'string')
    throw new Error('Recovery account missing');
  return await profileVisibleToPeople(s, accountId);
}

export const trailPreservation = (s: ProductHarness, actor: string) =>
  trails(s).preservationObligation(actor);
export async function recoveredAccountUsable(s: ProductHarness) {
  const id = s.probes.recoveryAccountId;
  if (typeof id !== 'string') throw new Error('Recovery owner missing');
  const rows = await s.harness.serverSql.sqlClient.query(
    sql<{
      id: string;
    }>`SELECT id FROM auth_users WHERE id = ${id} AND deleted_at IS NULL`
  );
  return rows.length > 0;
}
