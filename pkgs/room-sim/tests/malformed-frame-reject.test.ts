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
  readClient,
  readClientHash,
  readRejection,
  readServer,
} from '@pkgs/room-sim';

describe('room sim: malformed frame reject (E-D02)', () => {
  test('non-Message command payload rejects without mutate', async () => {
    await using s = await counterSystem.run({ seed: 42 });
    await s.apply(addClient, { id: 'alice' });
    await expectInSync(s);
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

    const err = await readRejection(s, 'alice');
    expect(err).not.toBeNull();
    expect(err?.type).toBe(ROOM_ERROR_TYPE.invalidCommand);
    expect(await s.read(logSeq)).toBe(0);
    expect(counterValue(await readServer(s))).toBe(0);
    expect(counterValue(await readClient(s, 'alice'))).toBe(0);
    expect(await readClientHash(s, 'alice')).toBe(before);
  });

  test('unknown wire kind is ignored without mutate', async () => {
    await using s = await counterSystem.run({
      seed: '43',
    });
    await s.apply(addClient, { id: 'alice' });
    await expectInSync(s);
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
