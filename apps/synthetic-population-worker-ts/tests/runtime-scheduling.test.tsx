import { expect, test } from 'bun:test';
import { recordedUi } from '@apps/synthetic-population-worker-ts/recorded-ui';
import type { SessionOutput } from '@apps/synthetic-population-worker-ts/session-messages';
import { SessionRuntime } from '@apps/synthetic-population-worker-ts/session-runtime';
import type { GameAutomation } from '@pkgs/turn-game-shared-ts/game-automation';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import { SolidDomDriver } from '@pkgs/ui-testing-solid-dom-client-ts/solid-dom-driver';
import { workerFixture } from './worker-fixture';

async function settle() {
  for (let index = 0; index < 1000; index += 1) await Promise.resolve();
}

async function schedulingFixture() {
  const f = workerFixture();
  const inputs: number[] = [];
  const messages: SessionOutput[] = [];
  const game: GameAutomation<Driver> = {
    rules: {
      id: 'counting',
      recognizes: (s) => s.startsWith('count:'),
      initial: () => 'count:0',
    },
    continuous: {
      intervalMs: 100,
      choose: () => 0.7,
      parseInput: (v) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : null),
      perform: (ui, board, side, value) =>
        ui.get(`${board}-${side}-control`).input(String(value)),
    },
  };
  const driver = new SolidDomDriver({
    clock: f.clock,
    harness: {
      createRoot: () => () => (
        <div
          data-testid="multiplayer-game"
          data-game-id="friday-counting"
          data-fen="count:0"
          data-shown-position="count:0"
          data-outcome="ongoing"
          data-can-move="true"
        >
          <div data-testid="multiplayer-seat-near" data-side="black">
            <span data-testid="multiplayer-colour">Second side</span>
          </div>
          <div data-testid="multiplayer-board">
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              data-testid="multiplayer-board-black-control"
              onInput={() => inputs.push(f.clock.now())}
            />
          </div>
        </div>
      ),
    },
  });
  await driver.launch();
  const runtime = new SessionRuntime(
    { ...f.assignment, registered: false },
    'https://app.example.test',
    {
      clock: f.clock,
      timers: f.timers,
      games: [game],
      send: (value) => messages.push(value),
      openApplication: async (input) => ({
        driver: recordedUi(driver, f.clock, input),
        token: 'fixture-token',
        activate: async () => {},
        route: () => '/',
        close: () => driver.close(),
      }),
    }
  );
  await runtime.start();
  runtime.receive({ type: 'activate' });
  return { ...f, runtime, inputs, messages };
}

test('one owned worker timer samples continuous controls between policy checkpoints and stops on disposal', async () => {
  // regression: synthetic-continuous-worker-policy-cadence
  const f = await schedulingFixture();
  const start = f.clock.now();
  try {
    f.clock.advance(3000);
    await settle();
    f.clock.advance(100);
    await settle();
    f.clock.advance(100);
    await settle();
    expect(f.inputs.map((at) => at - start)).toEqual([3000, 3100, 3200]);
    expect(f.messages.filter((m) => m.type === 'checkpoint')).toHaveLength(1);
    expect(f.clock.pendingOneShotCount()).toBe(1);
    await f.runtime.close();
    expect(f.clock.pendingOneShotCount()).toBe(0);
    f.clock.advance(3000);
    await settle();
    expect(f.inputs).toHaveLength(3);
    expect(f.messages.filter((m) => m.type === 'closed')).toHaveLength(1);
  } finally {
    await f.runtime.close();
  }
});

test('repeated continuous gestures retain local inspection history without flooding durable UI events', async () => {
  // regression: synthetic-continuous-ui-events-flood
  const f = await schedulingFixture();
  try {
    f.clock.advance(3000);
    await settle();
    f.clock.advance(100);
    await settle();
    f.clock.advance(100);
    await settle();
    expect(f.inputs).toHaveLength(3);
    expect(
      f.messages.filter(
        (m) => m.type === 'event' && m.event.name === 'UiDriverAction'
      )
    ).toHaveLength(2);
    f.runtime.receive({
      type: 'control',
      draining: false,
      renewal: {
        expiresAt: f.assignment.lease.expiresAt,
        config: f.assignment.config,
        paused: false,
        draining: false,
        commands: [],
        inspectionRequestedAt: '2026-01-01T00:00:03.200Z',
      },
    });
    f.clock.advance(2800);
    await settle();
    const inspection = f.messages.find((m) => m.type === 'inspection');
    expect(inspection?.type).toBe('inspection');
    if (inspection?.type !== 'inspection')
      throw new Error('Missing requested inspection');
    expect(
      inspection.snapshot.actions.filter(
        (action) => action.outcome === 'completed'
      )
    ).toHaveLength(4);
  } finally {
    await f.runtime.close();
  }
});
