import { expect, test } from 'bun:test';
import type { CustomGameInput } from '@libs/game-session-shared-ts/custom-game-choice';
import { ChangeCustomGame } from '@libs/game-session-shared-ts/custom-game-commands';
import { arenaGame } from './reference-arena-game';
import { liveSessionRoom } from './reference-live-session-room';

test('repeated resignations and rematches never accumulate simulation timers', async () => {
  const rig = await liveSessionRoom(false, arenaGame);
  try {
    const people = {
      alice: await rig.connect('alice'),
      bob: await rig.connect('bob'),
      carol: await rig.connect('carol'),
    };
    const choose = async (
      person: keyof typeof people,
      input: CustomGameInput
    ) => {
      people[person].dispatch(
        ChangeCustomGame({
          gameId: rig.current().id,
          revision: rig.current().revision,
          ...input,
        } as Parameters<typeof ChangeCustomGame>[0])
      );
      await rig.settle();
    };
    const ids = new Set<string>();
    for (let round = 0; round < 4; round++) {
      await rig.advance(3);
      expect(rig.current().status).toBe('active');
      ids.add(rig.current().id);
      // One owned simulation timer per running game.
      expect(rig.clock.pendingOneShotCount()).toBe(1);
      await choose('bob', { operation: 'resign' });
      expect(rig.current().status).toBe('completed');
      expect(rig.clock.pendingOneShotCount()).toBe(0);
      await choose('alice', { operation: 'rematch' });
      for (const person of ['alice', 'bob', 'carol'] as const)
        await choose(person, { operation: 'ready' });
      await choose('alice', { operation: 'start' });
    }
    expect(ids.size).toBe(4);
    expect(rig.errors).toEqual([]);
  } finally {
    rig.dispose();
  }
  expect(rig.clock.pendingOneShotCount()).toBe(0);
});
