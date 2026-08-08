import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  expectNoteNotLive,
  notesDomainPack,
  readLiveNotes,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld, type SimWorld } from '../../sim/world';

async function pump(
  world: SimWorld,
  work: Promise<unknown>,
  maxVirtualMs = 2_000
): Promise<void> {
  let done = false;
  const tracked = Promise.resolve(work).finally(() => {
    done = true;
  });
  const steps = Math.ceil(maxVirtualMs / 25);
  for (let i = 0; i < steps && !done; i += 1) {
    await world.runFor(25);
  }
  await tracked;
}

describe('auth revoked wipes db expired refreshes', () => {
  test('expired token refreshes; held queue drains and converges', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 601,
      faults: RELIABLE_FAULTS,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      await a.engine.disconnect();
      await a.mutate(setNote, { id: 'n-exp', body: 'queued-through-refresh' });
      await world.runFor(50);
      await expectNoteNotLive(world.server.db, 'n-exp');

      world.setAuthStatus('alice', 'expired');
      await a.engine.connect();
      await world.assertConverged();

      await expectLiveNote(b.db, 'n-exp', { body: 'queued-through-refresh' });
      await expectLiveNote(a.db, 'n-exp', { body: 'queued-through-refresh' });
    } finally {
      await world.dispose();
    }
  });

  test('revoked wipe drops unuploaded optimistic edit; restart rehydrates server only', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 602,
      faults: RELIABLE_FAULTS,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      await world.addClient({ id: 'bob' });

      await a.mutate(setNote, { id: 'n-kept', body: 'on-server' });
      await world.assertConverged();

      // Disconnect so mutate queues without HTTP upload.
      await a.engine.disconnect();
      await a.mutate(setNote, { id: 'n-lost', body: 'never-uploaded' });
      await world.runFor(50);
      await expectNoteNotLive(world.server.db, 'n-lost');

      world.setAuthStatus('alice', 'revoked');
      // Reconnect triggers query/upload → SyncApiAuthError revoked → wipe.
      await a.engine.connect();
      await world.runFor(500);
      await expectNoteNotLive(world.server.db, 'n-lost');

      const alice2 = await world.restartClient('alice');
      await world.assertConverged();

      await expectLiveNote(alice2.db, 'n-kept', { body: 'on-server' });
      await expectNoteNotLive(alice2.db, 'n-lost');
      await expectNoteNotLive(world.server.db, 'n-lost');
    } finally {
      await world.dispose();
    }
  });

  test('expired during multi-mutation drain refreshes without loss', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 603,
      faults: RELIABLE_FAULTS,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      await a.engine.disconnect();
      for (let i = 0; i < 5; i += 1) {
        await a.mutate(setNote, {
          id: `drain-${i}`,
          body: `d${i}`,
        });
      }
      await world.runFor(50);
      await expectNoteNotLive(world.server.db, 'drain-0');

      world.setAuthStatus('alice', 'expired');
      await a.engine.connect();
      a.engine.wakeUploads();
      await world.assertConverged();

      for (let i = 0; i < 5; i += 1) {
        await expectLiveNote(b.db, `drain-${i}`, { body: `d${i}` });
        await expectLiveNote(a.db, `drain-${i}`, { body: `d${i}` });
      }
    } finally {
      await world.dispose();
    }
  });

  test('revoked mid-push session wipes and detaches topics', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 604,
      faults: RELIABLE_FAULTS,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      await a.mutate(setNote, { id: 'n-before', body: 'visible' });
      await world.assertConverged();
      expect(a.subscribedTopics().length).toBeGreaterThan(0);

      world.setAuthStatus('alice', 'revoked');
      await b.mutate(setNote, { id: 'n-late', body: 'after-revoke' });
      await pump(world, a.engine.refreshQueries()).catch(() => undefined);
      await world.runFor(500);

      // Wipe detaches live topics; local DB may be closed by revoke path.
      expect(a.subscribedTopics()).toEqual([]);
      await expectLiveNote(world.server.db, 'n-before', { body: 'visible' });
      await expectLiveNote(b.db, 'n-late', { body: 'after-revoke' });

      const alice2 = await world.restartClient('alice');
      await world.assertConverged();
      await expectLiveNote(alice2.db, 'n-before', { body: 'visible' });
      await expectLiveNote(alice2.db, 'n-late', { body: 'after-revoke' });
      expect(await readLiveNotes(alice2.db)).toEqual(
        await readLiveNotes(world.server.db)
      );
    } finally {
      await world.dispose();
    }
  });
});
