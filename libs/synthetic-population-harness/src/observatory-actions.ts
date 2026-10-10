import { clientConfigTopic } from '@libs/app-config-shared/sync-topics';
import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { signedInAccountOf } from '@libs/harness/identity';
import {
  type AppPermission,
  ROLE,
} from '@libs/permissions-shared/permission-catalog';
import { DEFAULT_PERMISSION_POLICY } from '@libs/permissions-shared/permission-policy';
import { SyntheticPopulationAdministration } from '@libs/synthetic-population-server/synthetic-population-administration';
import { SyntheticPopulationRepository } from '@libs/synthetic-population-server/synthetic-population-repository';
import sql from '@pkgs/sql-root-shared/sql';
import { notifyChannels } from '@pkgs/sync-engine-server/notify-channels';

export const grantSyntheticPopulationAccess = scenarioAction({
  name: 'grantSyntheticPopulationAccess',
  act: async (s, actor: string, permissions: readonly AppPermission[]) => {
    const accountId = await signedInAccountOf(s, actor);
    if (accountId === null)
      throw new Error(
        'A Synthetic Population observer needs a normal signed-in account'
      );
    const policy = {
      ...DEFAULT_PERMISSION_POLICY,
      version: 'synthetic-population-spec',
      roles: {
        ...DEFAULT_PERMISSION_POLICY.roles,
        [ROLE.syntheticPopulationOperator]: {
          when: { accountId: [accountId] },
          permissions,
        },
      },
    };
    const db = s.harness.serverSql.sqlClient;
    const now = new Date(s.harness.clock.now()).toISOString();
    await db.run(
      sql`UPDATE client_config SET value = ${JSON.stringify(policy)}, updated_at = ${now} WHERE id = ${'permission_policy'}`
    );
    if (s.harness.server.events !== null)
      await notifyChannels({
        pubsub: s.harness.server.events,
        sql: db,
        tables: ['client_config'],
        topics: [clientConfigTopic()],
        now: s.harness.clock.now,
        label: 'synthetic-population-permission-fixture',
      });
    await s.session.waitForIdle();
  },
});
function ports(s: ProductHarness) {
  return {
    clock: s.harness.clock,
    createId: s.session.ports.createId,
    notify: async () => undefined,
  };
}
export const givenDesiredSyntheticPopulation = scenarioAction({
  name: 'givenDesiredSyntheticPopulation',
  act: async (s, desired: number) => {
    const db = s.harness.serverSql.sqlClient;
    const config = await new SyntheticPopulationRepository(
      db,
      ports(s)
    ).config();
    await new SyntheticPopulationAdministration(db, ports(s)).configure(
      { ...config, desired },
      s.session.ports.createId()
    );
  },
});
export const openObservatory = scenarioAction({
  name: 'openObservatory',
  act: async (s, actor: string) => {
    await actorUi(s, actor);
    await s.actors.get(actor)!.openLink('/admin/synthetic-population');
  },
});
export const changeDesiredSyntheticPopulation = scenarioAction({
  name: 'changeDesiredSyntheticPopulation',
  act: async (s, actor: string, desired: number) => {
    const ui = await actorUi(s, actor);
    await s.actors.get(actor)!.openLink('/admin/synthetic-population/config');
    if (await ui.get('synthetic-population-config-denied').isVisible()) return;
    await ui.get('synthetic-population-desired-input').clear();
    await ui.get('synthetic-population-desired-input').input(String(desired));
    await ui.get('synthetic-population-save').tap();
  },
});
export async function desiredSyntheticPopulationShown(
  s: ProductHarness,
  actor: string
): Promise<number | null> {
  const raw = await (await actorUi(s, actor))
    .get('synthetic-population-desired-value')
    .text();
  const number = raw?.match(/\d+\s*$/)?.[0];
  return number === undefined ? null : Number(number);
}
export async function syntheticPopulationDenied(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  const ui = await actorUi(s, actor);
  return (
    (await ui.get('synthetic-population-denied').isVisible()) ||
    (await ui.get('synthetic-population-config-denied').isVisible()) ||
    (await ui.get('synthetic-population-inspect-denied').isVisible())
  );
}
export async function syntheticActivityShown(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  return (await actorUi(s, actor))
    .get('synthetic-population-users')
    .isVisible();
}
export async function desiredSyntheticPopulation(s: ProductHarness) {
  return (
    await new SyntheticPopulationRepository(
      s.harness.serverSql.sqlClient,
      ports(s)
    ).config()
  ).desired;
}
