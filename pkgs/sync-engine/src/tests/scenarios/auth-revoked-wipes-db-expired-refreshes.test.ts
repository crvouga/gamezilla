import { describe, expect, test } from 'bun:test';
import { openWorld } from '../../sim/world';
import {
  acmeDomainPack,
  expectLiveNote,
  expectNoteNotLive,
  isLiveNote,
  readLiveNotes,
  setNote,
} from '../apps/acme';

describe('auth revoked wipes db expired refreshes', () => {
  test('expired token refreshes; held queue drains and converges', async () => {
    await using world = await openWorld({
      domain: acmeDomainPack,
      seed: 601,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.disconnect();
    await a.mutate(setNote, { id: 'n-exp', body: 'queued-through-refresh' });
    await world.never(() => isLiveNote(world.server.db, 'n-exp'), {
      forMs: 50,
    });

    world.node('alice').auth('expired');
    await a.connect();
    await world.assertConverged();

    await expectLiveNote(b.db, 'n-exp', { body: 'queued-through-refresh' });
    await expectLiveNote(a.db, 'n-exp', { body: 'queued-through-refresh' });
  });

  test('revoked wipe drops unuploaded optimistic edit; restart rehydrates server only', async () => {
    await using world = await openWorld({
      domain: acmeDomainPack,
      seed: 602,
    });
    const a = await world.addClient({ id: 'alice' });
    await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'n-kept', body: 'on-server' });
    await world.assertConverged();

    await a.disconnect();
    await a.mutate(setNote, { id: 'n-lost', body: 'never-uploaded' });
    await world.never(() => isLiveNote(world.server.db, 'n-lost'), {
      forMs: 50,
    });

    world.node('alice').auth('revoked');
    await a.connect();
    await world.never(() => isLiveNote(world.server.db, 'n-lost'), {
      forMs: 500,
    });

    const alice2 = await world.node('alice').restart();
    await world.assertConverged();

    await expectLiveNote(alice2!.db, 'n-kept', { body: 'on-server' });
    await expectNoteNotLive(alice2!.db, 'n-lost');
    await expectNoteNotLive(world.server.db, 'n-lost');
  });

  test('expired during multi-mutation drain refreshes without loss', async () => {
    await using world = await openWorld({
      domain: acmeDomainPack,
      seed: 603,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.disconnect();
    for (let i = 0; i < 5; i += 1) {
      await a.mutate(setNote, {
        id: `drain-${i}`,
        body: `d${i}`,
      });
    }
    await world.never(() => isLiveNote(world.server.db, 'drain-0'), {
      forMs: 50,
    });

    world.node('alice').auth('expired');
    await a.connect();
    await world.assertConverged();

    for (let i = 0; i < 5; i += 1) {
      await expectLiveNote(b.db, `drain-${i}`, { body: `d${i}` });
      await expectLiveNote(a.db, `drain-${i}`, { body: `d${i}` });
    }
  });

  test('revoked mid-push session wipes and detaches topics', async () => {
    await using world = await openWorld({
      domain: acmeDomainPack,
      seed: 604,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'n-before', body: 'visible' });
    await world.assertConverged();
    expect(a.subscribedTopics().length).toBeGreaterThan(0);

    world.node('alice').auth('revoked');
    await b.mutate(setNote, { id: 'n-late', body: 'after-revoke' });
    // nudge: revoke path may reject refresh — drive until settle/timeout
    await world.until(a.nudge().catch(() => undefined));
    await world.until(() => a.subscribedTopics().length === 0, {
      budgetMs: 2_000,
    });

    expect(a.subscribedTopics()).toEqual([]);
    await expectLiveNote(world.server.db, 'n-before', { body: 'visible' });
    await expectLiveNote(b.db, 'n-late', { body: 'after-revoke' });

    const alice2 = await world.node('alice').restart();
    await world.assertConverged();
    await expectLiveNote(alice2!.db, 'n-before', { body: 'visible' });
    await expectLiveNote(alice2!.db, 'n-late', { body: 'after-revoke' });
    expect(await readLiveNotes(alice2!.db)).toEqual(
      await readLiveNotes(world.server.db)
    );
  });

  test('upgrade_required rejects without wiping local rows', async () => {
    await using world = await openWorld({
      domain: acmeDomainPack,
      seed: 605,
    });
    const a = await world.addClient({ id: 'alice' });

    await a.mutate(setNote, { id: 'n-keep', body: 'local-and-server' });
    await world.assertConverged();

    world.node('alice').auth('upgrade_required');
    await a.disconnect();
    await a.connect();
    await world.until(
      () => (a.lastError() ?? '').includes('upgrade_required'),
      {
        budgetMs: 2_000,
      }
    );

    // Protocol cut must not wipe — local + server still hold the note.
    await expectLiveNote(a.db, 'n-keep', { body: 'local-and-server' });
    await expectLiveNote(world.server.db, 'n-keep', {
      body: 'local-and-server',
    });
  });

  test('seq invariants skip a revoked client after server restart', async () => {
    await using world = await openWorld({
      domain: acmeDomainPack,
      seed: 606,
    });
    const a = await world.addClient({ id: 'c0' });
    await world.addClient({ id: 'c1' });
    world.node('c0').auth('revoked');
    await a.connect();
    await world.node('server').restart({ preserveLocalDb: true });
    expect(await world.checkInvariants()).toBeNull();
  });
});
