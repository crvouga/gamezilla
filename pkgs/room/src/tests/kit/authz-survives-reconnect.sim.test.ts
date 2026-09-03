import { describe, expect, test } from 'bun:test';
import {
  addClient,
  connect,
  disconnect,
  dispatch,
  startRoom,
} from '../../sim/scenario';
import { ROOM_ERROR_TYPE } from '../../types';
import { authzSystem } from '../apps/authz/system';
import { expectConverged } from '../expect-converged';
import { authzCount, authzOwner, Bump, Claim } from '../fixtures/authz-module';
import { readClient, readRejection, readServer } from '../scenario/read-state';

describe('kit: authz survives reconnect (M-F05)', () => {
  test('non-owner still unauthorized after soft reconnect', async () => {
    await using run = await startRoom(authzSystem);
    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });
    await expectConverged(run);

    await run.apply(dispatch, {
      clientId: 'alice',
      payload: Claim({}),
    });
    expect(authzOwner(await readServer(run))).toBe('alice');
    expect(authzOwner(await readClient(run, 'alice'))).toBe('alice');

    await run.apply(dispatch, {
      clientId: 'bob',
      payload: Bump({}),
    });
    expect((await readRejection(run, 'bob'))?.type).toBe(
      ROOM_ERROR_TYPE.unauthorized
    );

    await run.apply(disconnect, 'bob');
    await run.apply(connect, 'bob');
    await run.apply(dispatch, {
      clientId: 'bob',
      payload: Bump({}),
    });
    expect((await readRejection(run, 'bob'))?.type).toBe(
      ROOM_ERROR_TYPE.unauthorized
    );
    expect(authzCount(await readServer(run))).toBe(0);
    expect(authzCount(await readClient(run, 'alice'))).toBe(0);
  });
});
