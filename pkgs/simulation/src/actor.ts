import type { Timers } from '@pkgs/clock';
import type { SimIo } from '@pkgs/io';
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
  readonly io: SimIo;
}): Promise<SimActor> {
  const { id, session, uiKind, io } = args;
  if (session.ui !== uiKind) {
    throw new Error(
      `SimActor(${id}): session ui '${session.ui}' does not match simulation ui '${uiKind}'`
    );
  }

  const driver = createDriverForSession(session, io);
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

/**
 * Driver wait polling must progress virtual time — otherwise `waitUntil` never
 * reaches its deadline under {@link createSimIo} timers.
 */
function driverTimers(io: SimIo): Timers {
  return {
    setTimeout: (fn, ms) => {
      const handle = io.timers.setTimeout(fn, ms);
      io.clock.advance(Math.max(0, ms));
      return handle;
    },
    clearTimeout: (handle) => {
      io.timers.clearTimeout(handle);
    },
    setInterval: (fn, ms) => {
      return io.timers.setInterval(fn, ms);
    },
    clearInterval: (handle) => {
      io.timers.clearInterval(handle);
    },
  };
}

function createDriverForSession(session: SimulationSession, io: SimIo): Driver {
  if (session.ui === 'in-process') {
    return createDriver({
      kind: 'in-process',
      harness: session.harness,
      now: io.clock.now,
      timers: driverTimers(io),
    });
  }
  const config: PlaywrightDriverConfig = {
    kind: 'playwright',
    page: session.page,
    ...(session.baseUrl !== undefined ? { baseUrl: session.baseUrl } : {}),
  };
  return createDriver(config);
}
