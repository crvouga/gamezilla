import { describe, expect, test } from 'bun:test';
import { addClient, connect, disconnect, dispatch } from '../../sim/scenario';
import { ROOM_ERROR_TYPE } from '../../types';
import { authzSystem } from '../apps/authz/system';
import { expectConverged } from '../expect-converged';
import { authzCount, authzOwner, Bump, Claim } from '../fixtures/authz-module';
import { readClient, readRejection, readServer } from '../scenario/read-state';

describe('kit: authz survives reconnect (M-F05)', () => {
  test('non-owner still unauthorized after soft reconnect', async () => {
    await using s = await authzSystem.script({ seed: 42 });
    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await expectConverged(s);

    await s.apply(dispatch, {
      clientId: 'alice',
      payload: Claim({}),
    });
    expect(authzOwner(await readServer(run))).toBe('alice');
    expect(authzOwner(await readClient(s, 'alice'))).toBe('alice');

    await s.apply(dispatch, {
      clientId: 'bob',
      payload: Bump({}),
    });
    expect((await readRejection(s, 'bob'))?.type).toBe(
      ROOM_ERROR_TYPE.unauthorized
    );

    await s.apply(disconnect, 'bob');
    await s.apply(connect, 'bob');
    await s.apply(dispatch, {
      clientId: 'bob',
      payload: Bump({}),
    });
    expect((await readRejection(s, 'bob'))?.type).toBe(
      ROOM_ERROR_TYPE.unauthorized
    );
    expect(authzCount(await readServer(run))).toBe(0);
    expect(authzCount(await readClient(s, 'alice'))).toBe(0);
  });
});
