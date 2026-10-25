import { expect, test } from 'bun:test';
import { AddOne, readTally } from '@pkgs/room-root-harness-ts/game-room';
import { ROOM_SERVICE_GRANT } from '@pkgs/room-root-shared-ts/service-identity';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared-ts/types';
import { startServer } from './server-rig';

test('a service receipt captures its serial state and retries count once', async () => {
  const rig = await startServer();
  const submit = (id: string) =>
    rig.server.injectServiceCommand({
      id,
      payload: AddOne({}),
      identity: 'room:service',
    });
  const [first, second] = await Promise.all([submit('one'), submit('two')]);
  expect(first.ok).toBe(true);
  expect(second.ok).toBe(true);
  if (!first.ok || !second.ok) throw new Error('service commands refused');
  expect(readTally(first.state)).toBe(1);
  expect(readTally(second.state)).toBe(2);
  const retry = await submit('one');
  expect(retry.ok).toBe(true);
  if (!retry.ok) throw new Error('service retry refused');
  expect(readTally(retry.state)).toBe(2);
  expect(rig.storage.entries).toHaveLength(2);
  Object.assign(first.state, { 'receipt/mutation': true });
  expect(
    Object.hasOwn(rig.server.getCommittedState(), 'receipt/mutation')
  ).toBe(false);
});

test('a service retry returns the stored refusal after authorization changes', async () => {
  let allowed = false;
  const rig = await startServer({
    authorize: async (_identity, _topic, _command, grants) => {
      expect(grants).toContain(ROOM_SERVICE_GRANT);
      return allowed ? { ok: true } : { ok: false, reason: 'closed' };
    },
  });
  const command = { id: 'refused', payload: AddOne({}), identity: 'service' };
  const first = await rig.server.injectServiceCommand(command);
  allowed = true;
  expect(await rig.server.injectServiceCommand(command)).toEqual(first);
  expect(first).toEqual({
    ok: false,
    error: { type: ROOM_ERROR_TYPE.unauthorized, reason: 'closed' },
  });
  expect(rig.storage.entries).toHaveLength(0);
});
