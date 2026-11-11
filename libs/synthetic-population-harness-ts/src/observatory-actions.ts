import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { runScopedCreateId } from '@libs/harness-ts/run-scope';
import {
  SYNTHETIC_POPULATION_SETTINGS_PATH,
  SYNTHETIC_USERS_PATH,
} from '@libs/observatory-shared-ts/observatory-routes';
import { SyntheticPopulationAdministration } from '@libs/synthetic-population-server-ts/synthetic-population-administration';
import { SyntheticPopulationRepository } from '@libs/synthetic-population-server-ts/synthetic-population-repository';
import { settleAboveDesired } from './live-synthetic-users';
import { runDeployedWorker } from './population-worker';

function ports(s: ProductHarness) {
  return {
    clock: s.harness.clock,
    createId: runScopedCreateId(s),
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
      runScopedCreateId(s)()
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
/**
 * The person opens the Synthetic Users table from the Synthetic Population
 * panel, as they would; a panel they may not open stays on its denial.
 */
export const openSyntheticUserDirectory = scenarioAction({
  name: 'openSyntheticUserDirectory',
  act: async (s, actor: string) => {
    const ui = await actorUi(s, actor);
    await s.actors.get(actor)!.openLink(SYNTHETIC_USERS_PATH);
    await s.session.waitForIdle();
    if (await ui.get('synthetic-population-denied').isVisible()) return;
    await ui.get('synthetic-population-open-directory').tap();
    await s.session.waitForIdle();
  },
});
export const changeDesiredSyntheticPopulation = scenarioAction({
  name: 'changeDesiredSyntheticPopulation',
  act: async (s, actor: string, desired: number) => {
    // A deployed worker is running, as in production, to act on the change.
    runDeployedWorker(s, false);
    const ui = await actorUi(s, actor);
    await s.actors.get(actor)!.openLink(SYNTHETIC_POPULATION_SETTINGS_PATH);
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
  // Neither the Synthetic Users table nor the way to it.
  const ui = await actorUi(s, actor);
  return (
    (await ui.get('synthetic-population-user').isVisible()) ||
    (await ui.get('synthetic-population-open-directory').isVisible())
  );
}
export async function desiredSyntheticPopulation(s: ProductHarness) {
  return (
    await new SyntheticPopulationRepository(
      s.harness.serverSql.sqlClient,
      ports(s)
    ).config()
  ).desired;
}
