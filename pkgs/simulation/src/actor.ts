import type { Timers } from '@pkgs/clock';
import type { SimIo } from '@pkgs/io';
import type { SimulationReporter } from '@pkgs/simulation-report';
import {
  createDriver,
  type Driver,
  type PlaywrightDriverConfig,
} from '@pkgs/ui-testing';

import { runWithSimNode } from './context/sim-node-als';
import type { EventLog } from './events';
import { createReportingDriver } from './report/reporting-driver';
import type { SimulationSession, SimulationUiKind } from './system-port';

/**
 * One user session in a simulation. The only test-facing surface is {@link ui}.
 */
export type SimActor = {
  readonly id: string;
  /** Portable UI driver — assert and interact only through this. */
  readonly ui: Driver;
  dispose(): Promise<void>;
};

export async function createSimActor(args: {
  readonly id: string;
  readonly session: SimulationSession;
  readonly uiKind: SimulationUiKind;
  readonly io: SimIo;
  readonly reporter?: SimulationReporter;
  readonly events?: EventLog;
  readonly onDriverOp?: () => void | Promise<void>;
}): Promise<SimActor> {
  const { id, session, uiKind, io, reporter, events, onDriverOp } = args;
  if (session.ui !== uiKind) {
    throw new Error(
      `SimActor(${id}): session ui '${session.ui}' does not match simulation ui '${uiKind}'`
    );
  }

  const rawDriver = createDriverForSession(session, io);
  const attributed = wrapDriverWithNodeContext(rawDriver, id, onDriverOp);
  const driver =
    reporter !== undefined
      ? createReportingDriver(attributed, {
          actorId: id,
          reporter,
          ...(events !== undefined ? { events } : {}),
        })
      : attributed;

  await driver.launch();

  return {
    id,
    ui: driver,
    async dispose() {
      await driver.close();
      await session.dispose();
    },
  };
}

function wrapDriverWithNodeContext(
  driver: Driver,
  nodeId: string,
  onDriverOp?: () => void | Promise<void>
): Driver {
  const wrap =
    <A extends unknown[]>(fn: (...a: A) => Promise<void>) =>
    async (...a: A) => {
      await runWithSimNode(nodeId, () => fn(...a));
      await onDriverOp?.();
    };
  return {
    kind: driver.kind,
    launch: () => runWithSimNode(nodeId, () => driver.launch()),
    close: () => runWithSimNode(nodeId, () => driver.close()),
    tap: wrap(driver.tap.bind(driver)),
    tapAt: wrap(driver.tapAt.bind(driver)),
    input: wrap(driver.input.bind(driver)),
    clear: wrap(driver.clear.bind(driver)),
    key: wrap(driver.key.bind(driver)),
    scroll: wrap(driver.scroll.bind(driver)),
    wait: wrap(driver.wait.bind(driver)),
    expect: {
      visible: wrap(driver.expect.visible.bind(driver.expect)),
      hidden: wrap(driver.expect.hidden.bind(driver.expect)),
      text: wrap(driver.expect.text.bind(driver.expect)),
    },
    isVisible: (testId) =>
      runWithSimNode(nodeId, () => driver.isVisible(testId)),
    getText: (testId) => runWithSimNode(nodeId, () => driver.getText(testId)),
    snapshotHtml: (options) =>
      runWithSimNode(nodeId, () => driver.snapshotHtml(options)),
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
    const wait = session.driverWait;
    return createDriver({
      kind: 'in-process',
      harness: session.harness,
      now: wait?.now ?? io.clock.now,
      timers: wait?.timers ?? driverTimers(io),
    });
  }
  const config: PlaywrightDriverConfig = {
    kind: 'playwright',
    page: session.page,
    ...(session.baseUrl !== undefined ? { baseUrl: session.baseUrl } : {}),
  };
  return createDriver(config);
}
