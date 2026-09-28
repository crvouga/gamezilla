/**
 * Harness contract: the room-restart fault. `serverCrash` takes the room
 * down until `serverRestart` brings it back from its stored log, with every
 * change it had. The Quint model's `_roomRestarts` draws this fault in
 * traces; this pins that the fault really takes the room down between the
 * two halves, which a trace cannot see.
 */

import { describe, expect, test } from 'bun:test';
import { AddOne, readTally } from '@pkgs/room/harness';
import {
  addClient,
  dispatch,
  exampleSystem,
  expectInSync,
  readClient,
  readServer,
  serverCrash,
  serverCrashed,
  serverRestart,
} from '@pkgs/room-harness';

describe('room restart fault', () => {
  test('a crashed room is down until it restarts, then has its tally', async () => {
    await using s = await exampleSystem.run({ seed: 'room-restart' });
    for (const id of ['alice', 'bob']) {
      await s.apply(addClient, { id, identity: id });
    }
    await expectInSync(s);
    for (let i = 0; i < 2; i += 1) {
      await s.apply(dispatch, { clientId: 'alice', payload: AddOne({}) });
    }
    await expectInSync(s);

    await s.apply(serverCrash);
    expect(await s.read(serverCrashed)).toBe(true);

    await s.apply(serverRestart);
    expect(await s.read(serverCrashed)).toBe(false);
    await expectInSync(s);
    expect(readTally(await readServer(s))).toBe(2);
    for (const id of ['alice', 'bob']) {
      expect(readTally(await readClient(s, id))).toBe(2);
    }
  });
});
