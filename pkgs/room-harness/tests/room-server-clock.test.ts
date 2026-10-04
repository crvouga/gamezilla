import { expect, test } from 'bun:test';
import {
  addOneCommand,
  connectPerson,
  startServer,
} from './server-rig';

// regression: room-command-client-time
test('the module and authorization receive server time despite an earlier client timestamp', async () => {
  const times: number[] = [];
  const rig = await startServer({
    authorize: (_identity, _topic, command) => {
      times.push(command.ts);
      return Promise.resolve({ ok: true });
    },
  });
  connectPerson(rig, 'alice');
  await rig.server.handleClientMessage('alice', 'alice', {
    ...addOneCommand('earlier-clock'),
    ts: 7,
  });
  expect(times).toEqual([1000]);
  expect(rig.storage.entries[0]?.ts).toBe(1000);
});
