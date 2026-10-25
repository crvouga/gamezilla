import { expect, test } from 'bun:test';
import { SubmitSimulationInput } from '@libs/game-session-shared-ts/simulation-messages';
import { arenaCodec, arenaGame } from './reference-arena-game';
import { liveSessionRoom } from './reference-live-session-room';
import { requestState } from './reference-simulation-room';

test("a continuing arena keeps running for everyone when the space's host is the one who drops", async () => {
  // regression: simulation-host-absence-retires-everyone
  // Alice hosts the space (her connection is its authority); Bob's and
  // Carol's connections depend on it. Her absence is one rider's absence.
  const rig = await liveSessionRoom(false, arenaGame);
  try {
    const alice = await rig.connect('alice');
    const bob = await rig.connect('bob');
    await rig.connect('carol');
    await rig.advance(2);
    rig.transports.get('alice')!.closeFromServer();
    await rig.settle();
    expect(rig.current().execution).toMatchObject({
      phase: 'running',
      missing: ['white'],
    });
    const snapshot = await requestState(bob);
    bob.sendSignal(
      SubmitSimulationInput({
        version: 1,
        epoch: snapshot.epoch,
        playerId: 'black',
        sequence: 1,
        tick: snapshot.tick,
        value: { round: 1, turn: 'right' },
      })
    );
    await rig.settle();
    await rig.advance(12);
    const during = arenaCodec.decode((await requestState(bob)).state)!;
    expect(during.retired).toEqual(['white']);
    expect(during.log.some((entry) => entry.endsWith(':black:1:right'))).toBe(
      true
    );
    expect(rig.current().status).toBe('active');
    expect(rig.errors).toEqual([]);
    void alice;
  } finally {
    rig.dispose();
  }
});
