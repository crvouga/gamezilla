import { afterEach, expect, test } from 'bun:test';
import { useCustomSimulation } from '@libs/game-session-client-ts/use-custom-simulation';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { createNoopLogger } from '@pkgs/logger-shared-ts/logger';
import { cleanup } from '@solidjs/testing-library';
import { createComputed, createSignal, untrack } from 'solid-js';
import { LocalFailureProviders, localFailure } from './reference-local-failure';

afterEach(cleanup);

test('a control surface reads no reactive state, so releasing input while a board is disposed re-runs nothing', async () => {
  // regression: simulation-controls-rerun-disposing-board
  const rig = await localFailure();
  const [allowed, setAllowed] = createSignal(true);
  let runs = 0;
  function Probe() {
    const simulation = useCustomSimulation(
      () => rig.game,
      () => 'alice',
      allowed
    );
    const controls = untrack(simulation.controls);
    // A board's teardown hands its surface neutral input, then releases it.
    createComputed(() => {
      runs += 1;
      for (const side of controls.sides)
        controls.onInput(side, { kind: 'direction', direction: 0 });
      controls.onRelease();
    });
    return null;
  }
  const view = renderWithI18n(() => (
    <LocalFailureProviders rig={rig} logger={createNoopLogger()}>
      <Probe />
    </LocalFailureProviders>
  ));
  try {
    expect(runs).toBe(1);
    setAllowed(false);
    expect(runs).toBe(1);
  } finally {
    view.unmount();
    rig.room.destroy();
  }
});
