/**
 * Wire contract: a message that is not a valid command is refused as an
 * invalid command, and one of an unknown kind is ignored. Neither commits
 * anything or changes what the sender's device shows.
 */

import { describe, expect, test } from 'bun:test';
import { ROOM_ERROR_TYPE } from '@pkgs/room';
import {
  addClient,
  clock,
  counterSystem,
  counterValue,
  expectInSync,
  injectToServer,
  logSeq,
  readClientHash,
  readRejection,
  readServer,
} from '@pkgs/room-sim';

async function openCounter(seed: string) {
  const s = await counterSystem.run({ seed });
  await s.apply(addClient, { id: 'alice' });
  await expectInSync(s);
  return s;
}

describe('room sim: malformed messages', () => {
  test('a command whose payload is not a message is refused without effect', async () => {
    await using s = await openCounter('malformed-payload');
    const before = await readClientHash(s, 'alice');
    await s.apply(injectToServer, {
      clientId: 'alice',
      raw: {
        v: 1,
        kind: 'command',
        id: 'bad-1',
        ts: await s.read(clock),
        payload: { not: 'a-message' },
      },
      direct: true,
    });
    expect((await readRejection(s, 'alice'))?.type).toBe(
      ROOM_ERROR_TYPE.invalidCommand
    );
    expect(await s.read(logSeq)).toBe(0);
    expect(counterValue(await readServer(s))).toBe(0);
    expect(await readClientHash(s, 'alice')).toBe(before);
  });

  test('a message of unknown kind is ignored', async () => {
    await using s = await openCounter('malformed-kind');
    const before = await readClientHash(s, 'alice');
    await s.apply(injectToServer, {
      clientId: 'alice',
      raw: { v: 1, kind: 'nope' },
      direct: true,
    });
    expect(await s.read(logSeq)).toBe(0);
    expect(counterValue(await readServer(s))).toBe(0);
    expect(await readClientHash(s, 'alice')).toBe(before);
  });
});
