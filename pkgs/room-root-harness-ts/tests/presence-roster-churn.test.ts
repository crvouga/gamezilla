import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { AddOne, gameRoomModule } from '@pkgs/room-root-harness-ts/game-room';
import fc from 'fast-check';
import { connectPerson, startServer } from './server-rig';

async function observerChurn(count: number) {
  const seen: (readonly string[])[] = [];
  const rig = await startServer({
    module: {
      ...gameRoomModule,
      connectionView: (grants) =>
        grants.includes('participate')
          ? { mode: 'full' }
          : { mode: 'presence', reason: 'participation required' },
      presenceCommand: (_state, present) => {
        seen.push(present);
        return present.length === 0 ? AddOne({}) : null;
      },
    },
  });
  for (let i = 0; i < count; i++) {
    connectPerson(rig, `preview-${i}`);
    await rig.server.readCommittedState();
  }
  const before = rig.storage.entries.length;
  connectPerson(rig, 'alice', ['participate']);
  await rig.server.readCommittedState();
  for (let i = 0; i < count; i++) {
    rig.server.unregisterConnection(`preview-${i}`);
    await rig.server.readCommittedState();
  }
  rig.server.unregisterConnection('alice');
  await rig.server.readCommittedState();
  return { before, seen, entries: rig.storage.entries.length };
}

// regression: presence-observers-create-away-transitions
test('a preview before the first participant cannot create an away transition', async () => {
  expect(await observerChurn(1)).toEqual({
    before: 0,
    seen: [['alice'], []],
    entries: 1,
  });
});

test('observer churn never changes the participant presence history', async () => {
  await assertProperty(
    'participant presence ignores observer churn',
    fc.asyncProperty(fc.integer({ min: 1, max: 6 }), async (count) => {
      expect(await observerChurn(count)).toEqual({
        before: 0,
        seen: [['alice'], []],
        entries: 1,
      });
    })
  );
});
