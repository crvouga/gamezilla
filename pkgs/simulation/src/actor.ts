import {
  createDriver,
  type Driver,
  type PlaywrightDriverConfig,
} from '@pkgs/ui-testing';

import type { SimulationUiKind } from './options';
import type { SimulationSession } from './system-port';

/**
 * One user session in a simulation. The only test-facing surface is {@link ui}.
 */
export type SimActor = {
  readonly id: string;
  /** Portable UI driver — assert and interact only through this. */
  readonly ui: Driver;
  open(path: string): Promise<void>;
  dispose(): Promise<void>;
};

export async function createSimActor(args: {
  readonly id: string;
  readonly session: SimulationSession;
  readonly uiKind: SimulationUiKind;
}): Promise<SimActor> {
  const { id, session, uiKind } = args;
  if (session.ui !== uiKind) {
    throw new Error(
      `SimActor(${id}): session ui '${session.ui}' does not match simulation ui '${uiKind}'`
    );
  }

  const driver = createDriverForSession(session);
  await driver.launch();

  return {
    id,
    ui: driver,
    open: (path) => session.open(path),
    async dispose() {
      await driver.close();
      await session.dispose();
    },
  };
}

function createDriverForSession(session: SimulationSession): Driver {
  if (session.ui === 'in-process') {
    return createDriver({
      kind: 'in-process',
      harness: session.harness,
    });
  }
  const config: PlaywrightDriverConfig = {
    kind: 'playwright',
    page: session.page,
    ...(session.baseUrl !== undefined ? { baseUrl: session.baseUrl } : {}),
  };
  return createDriver(config);
}
