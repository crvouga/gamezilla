import { expect, test } from 'bun:test';
import { CustomGamesAttr } from '@libs/game-session-shared-ts/custom-game-state';
import { LocalSimulationSession } from '@libs/game-session-shared-ts/simulation-local-session';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { continuousRaceGame } from './reference-continuous-game';
import { liveSessionRoom } from './reference-live-session-room';
import { requestLocalState } from './reference-local-persistence';

test("a local game under way runs on the device that started it, never again on its owner's other device", async () => {
  // regression: local-simulation-runs-on-two-devices
  const rig = await liveSessionRoom(true);
  let sequence = 0;
  const errors: unknown[] = [];
  const options = {
    owner: 'alice',
    rules: createTurnGames([continuousRaceGame.registration]),
    ...rig,
    createId: () => `local-${++sequence}`,
    onError: (error: unknown) => errors.push(error),
  };
  const first = await rig.connect('alice');
  const running = new LocalSimulationSession({ ...options, room: first });
  try {
    await running.flush();
    rig.clock.advance(100);
    await running.flush();
    expect((await requestLocalState(running)).tick).toBeGreaterThan(0);
    await rig.settle();
    expect(rig.current().execution).toBeDefined();
    const phone = await rig.connect('alice', undefined, 'alice-phone');
    expect(
      CustomGamesAttr.from(phone.getSnapshot()).current?.execution
    ).toBeDefined();
    const elsewhere = new LocalSimulationSession({ ...options, room: phone });
    try {
      await elsewhere.flush();
      rig.clock.advance(100);
      await elsewhere.flush();
      expect(elsewhere.runsElsewhere()).toBe(true);
      expect(elsewhere.isReady()).toBe(false);
      expect(running.runsElsewhere()).toBe(false);
      expect(errors).toEqual([]);
    } finally {
      elsewhere.dispose();
    }
  } finally {
    running.dispose();
    rig.dispose();
  }
});
