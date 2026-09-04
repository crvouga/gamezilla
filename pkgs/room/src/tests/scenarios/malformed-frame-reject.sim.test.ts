import { describe, expect, test } from 'bun:test';
import { addClient, clock, injectToServer, logSeq } from '../../sim/scenario';
import { ROOM_ERROR_TYPE } from '../../types';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';
import { counterValue } from '../fixtures/counter-module';
import {
  readClient,
  readClientHash,
  readRejection,
  readServer,
} from '../scenario/read-state';

describe('room sim: malformed frame reject (E-D02)', () => {
  test('non-Message command payload rejects without mutate', async () => {
    await using s = await counterSystem.script({ seed: 42 });
    await s.apply(addClient, { id: 'alice' });
    await expectConverged(s);
    const before = await readClientHash(s, 'alice');

    await s.apply(injectToServer, {
      clientId: 'alice',
      raw: {
        v: 1,
        kind: 'command',
        id: 'bad-1',
        ts: await s.observe(clock),
        payload: { not: 'a-message' },
      },
      direct: true,
    });

    const err = await readRejection(s, 'alice');
    expect(err).not.toBeNull();
    expect(err?.type).toBe(ROOM_ERROR_TYPE.invalidCommand);
    expect(await s.observe(logSeq)).toBe(0);
    expect(counterValue(await readServer(run))).toBe(0);
    expect(counterValue(await readClient(s, 'alice'))).toBe(0);
    expect(await readClientHash(s, 'alice')).toBe(before);
  });

  test('unknown wire kind is ignored without mutate', async () => {
    await using s = await counterSystem.script({
      seed: '43',
    });
    await s.apply(addClient, { id: 'alice' });
    await expectConverged(s);
    const before = await readClientHash(s, 'alice');
    await s.apply(injectToServer, {
      clientId: 'alice',
      raw: { v: 1, kind: 'nope' },
      direct: true,
    });
    expect(await s.observe(logSeq)).toBe(0);
    expect(counterValue(await readServer(run))).toBe(0);
    expect(await readClientHash(s, 'alice')).toBe(before);
  });
});
