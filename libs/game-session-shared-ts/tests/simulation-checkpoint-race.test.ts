import { expect, test } from 'bun:test';
import { continuousRaceGame } from './reference-continuous-game';
import { liveSessionRoom } from './reference-live-session-room';
import { requestState } from './reference-simulation-room';

test.each([false, true])(
  'concurrent departures discard an obsolete presence checkpoint without stopping authority (matched=%s)',
  async (matched) => {
    // regression: simulation-presence-checkpoint-race
    const rig = await liveSessionRoom(false, continuousRaceGame, matched);
    try {
      const alice = await rig.connect('alice');
      const bob = await rig.connect('bob');
      await rig.advance(5);
      alice.destroy();
      bob.destroy();
      await rig.settle();
      expect(rig.errors).toEqual([]);
      const execution = matched
        ? rig.match().execution
        : rig.current().execution;
      expect(execution?.phase).toBe('paused');
      expect(execution?.missing).toEqual(['black', 'white']);
      const returned = await rig.connect('alice');
      await rig.connect('bob');
      await rig.advance(5);
      expect(rig.errors).toEqual([]);
      expect((await requestState(returned)).tick).toBeGreaterThan(5);
    } finally {
      rig.dispose();
    }
  }
);
