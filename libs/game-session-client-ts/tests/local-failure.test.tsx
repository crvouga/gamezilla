import { afterEach, expect, test } from 'bun:test';
import { useCustomSimulation } from '@libs/game-session-client-ts/use-custom-simulation';
import { CustomGamesAttr } from '@libs/game-session-shared-ts/custom-game-state';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { createNoopLogger, type Logger } from '@pkgs/logger-shared-ts/logger';
import { cleanup } from '@solidjs/testing-library';
import { LocalFailureProviders, localFailure } from './reference-local-failure';

afterEach(cleanup);

test.each(['available', 'unavailable'] as const)(
  'a stopped local game forwards its error and keeps recovery with %s logging',
  async (sink) => {
    // regression: local-simulation-failure-not-observed
    const rig = await localFailure();
    const errors: unknown[] = [];
    const logger: Logger = {
      ...createNoopLogger(),
      child: () => logger,
      error: (_message, detail) => {
        errors.push(detail?.['error']);
        if (sink === 'unavailable')
          throw new Error('diagnostic sink unavailable');
      },
    };
    let controller: ReturnType<typeof useCustomSimulation> | null = null;
    function Probe() {
      controller = useCustomSimulation(
        () => rig.game,
        () => 'alice',
        () => true
      );
      return null;
    }
    const view = renderWithI18n(() => (
      <LocalFailureProviders rig={rig} logger={logger}>
        <Probe />
      </LocalFailureProviders>
    ));
    try {
      for (let turn = 0; turn < 100; turn++) await Promise.resolve();
      if (controller === null)
        throw new Error('The simulation hook did not mount');
      expect(
        (controller as ReturnType<typeof useCustomSimulation>).error()
      ).toBe(true);
      expect(errors).toContain(rig.failure);
      expect(CustomGamesAttr.from(rig.room.getSnapshot()).current?.status).toBe(
        'active'
      );
      expect(await rig.storage.loadQueued()).toEqual([]);
    } finally {
      view.unmount();
      rig.room.destroy();
    }
    expect(rig.clock.pendingOneShotCount()).toBe(0);
  }
);
