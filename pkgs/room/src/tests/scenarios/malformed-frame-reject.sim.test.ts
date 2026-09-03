import { describe, expect, test } from 'bun:test';
import { addClient, clock, injectToServer, logSeq } from '../../sim/scenario';
import { ROOM_ERROR_TYPE } from '../../types';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';
import { counterValue } from '../fixtures/counter-module';
import { openRoom } from '../scenario/open-room';
import {
  readClient,
  readClientHash,
  readRejection,
  readServer,
} from '../scenario/read-state';

describe('room sim: malformed frame reject (E-D02)', () => {
  test('non-Message command payload rejects without mutate', async () => {
    await using run = await openRoom(counterSystem);
    await run.apply(addClient, { id: 'alice' });
    await expectConverged(run);
    const before = await readClientHash(run, 'alice');

    await run.apply(injectToServer, {
      clientId: 'alice',
      raw: {
        v: 1,
        kind: 'command',
        id: 'bad-1',
        ts: await run.observe(clock),
        payload: { not: 'a-message' },
      },
      direct: true,
    });

    const err = await readRejection(run, 'alice');
    expect(err).not.toBeNull();
    expect(err?.type).toBe(ROOM_ERROR_TYPE.invalidCommand);
    expect(await run.observe(logSeq)).toBe(0);
    expect(counterValue(await readServer(run))).toBe(0);
    expect(counterValue(await readClient(run, 'alice'))).toBe(0);
    expect(await readClientHash(run, 'alice')).toBe(before);
  });

  test('unknown wire kind is ignored without mutate', async () => {
    await using run = await openRoom(counterSystem, { seed: '43' });
    await run.apply(addClient, { id: 'alice' });
    await expectConverged(run);
    const before = await readClientHash(run, 'alice');
    await run.apply(injectToServer, {
      clientId: 'alice',
      raw: { v: 1, kind: 'nope' },
      direct: true,
    });
    expect(await run.observe(logSeq)).toBe(0);
    expect(counterValue(await readServer(run))).toBe(0);
    expect(await readClientHash(run, 'alice')).toBe(before);
  });
});
