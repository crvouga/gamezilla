import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import {
  SYNTHETIC_USERS_CONFIG_PATH,
  SYNTHETIC_USERS_PATH,
} from '@libs/observatory-shared-ts/observatory-routes';
import { SyntheticPopulationAdministration } from '@libs/synthetic-population-server-ts/synthetic-population-administration';
import { SyntheticPopulationRepository } from '@libs/synthetic-population-server-ts/synthetic-population-repository';
import { settleAboveDesired } from './live-synthetic-users';
import { runDeployedWorker } from './population-worker';

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
/** The person opens the Synthetic Population panel of the User Observatory. */
export const openSyntheticPopulationPanel = scenarioAction({
  name: 'openSyntheticPopulationPanel',
  act: async (s, actor: string) => {
    await actorUi(s, actor);
    await s.actors.get(actor)!.openLink(SYNTHETIC_USERS_PATH);
  },
});
export const changeDesiredSyntheticPopulation = scenarioAction({
  name: 'changeDesiredSyntheticPopulation',
  act: async (s, actor: string, desired: number) => {
    // A deployed worker is running, as in production, to act on the change.
    runDeployedWorker(s, false);
    const ui = await actorUi(s, actor);
    await s.actors.get(actor)!.openLink(SYNTHETIC_USERS_CONFIG_PATH);
    if (await ui.get('synthetic-population-config-denied').isVisible()) return;
    await ui.get('synthetic-population-desired-input').clear();
    await ui.get('synthetic-population-desired-input').input(String(desired));
    await ui.get('synthetic-population-save').tap();
    // Synthetic Users above the new desired population finish and leave.
    await settleAboveDesired(s, desired);
  },
});
export async function desiredSyntheticPopulationShown(
  s: ProductHarness,
  actor: string
): Promise<number | null> {
  const node = (await actorUi(s, actor)).get(
    'synthetic-population-desired-value'
  );
  if (!(await node.isVisible())) return null;
  const raw = await node.text();
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
    (await ui.get('synthetic-population-inspect-denied').isVisible()) ||
    (await ui.get('synthetic-population-control-denied').isVisible())
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
