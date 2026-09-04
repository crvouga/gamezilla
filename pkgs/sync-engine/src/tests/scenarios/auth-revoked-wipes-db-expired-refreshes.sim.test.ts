import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  auth,
  connect,
  disconnect,
  expectConverged,
  expectLiveNoteAt,
  expectNoteNotLiveAt,
  expectNotesAgree,
  invariantViolations,
  lastError,
  liveNote,
  mutate,
  neverAcme,
  nudge,
  restart,
  setNote,
  subscribedTopics,
  untilAcme,
} from '../apps/acme';

describe('auth revoked wipes db expired refreshes', () => {
  test('expired token refreshes; held queue drains and converges', async () => {
    await using s = await acmeSystem.script({
      seed: 601,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    await s.apply(disconnect, 'alice');
    await s.apply(mutate, 'alice', setNote, {
      id: 'n-exp',
      body: 'queued-through-refresh',
    });
    await neverAcme(s, (s) => liveNote(s, 'server', 'n-exp'), { forMs: 50 });

    await s.apply(auth, 'alice', 'expired');
    await s.apply(connect, 'alice');
    await expectConverged(s);

    await expectLiveNoteAt(s, 'bob', 'n-exp', {
      body: 'queued-through-refresh',
    });
    await expectLiveNoteAt(s, 'alice', 'n-exp', {
      body: 'queued-through-refresh',
    });
  });

  test('revoked wipe drops unuploaded optimistic edit; restart rehydrates server only', async () => {
    await using s = await acmeSystem.script({
      seed: 602,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    await s.apply(mutate, 'alice', setNote, {
      id: 'n-kept',
      body: 'on-server',
    });
    await expectConverged(s);

    await s.apply(disconnect, 'alice');
    await s.apply(mutate, 'alice', setNote, {
      id: 'n-lost',
      body: 'never-uploaded',
    });
    await neverAcme(s, (s) => liveNote(s, 'server', 'n-lost'), { forMs: 50 });

    await s.apply(auth, 'alice', 'revoked');
    await s.apply(connect, 'alice');
    await neverAcme(s, (s) => liveNote(s, 'server', 'n-lost'), {
      forMs: 500,
    });

    await s.apply(restart, 'alice', {});
    await expectConverged(s);

    await expectLiveNoteAt(s, 'alice', 'n-kept', { body: 'on-server' });
    await expectNoteNotLiveAt(s, 'alice', 'n-lost');
    await expectNoteNotLiveAt(s, 'server', 'n-lost');
  });

  test('expired during multi-mutation drain refreshes without loss', async () => {
    await using s = await acmeSystem.script({
      seed: 603,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    await s.apply(disconnect, 'alice');
    for (let i = 0; i < 5; i += 1) {
      await s.apply(mutate, 'alice', setNote, {
        id: `drain-${i}`,
        body: `d${i}`,
      });
    }
    await neverAcme(s, (s) => liveNote(s, 'server', 'drain-0'), {
      forMs: 50,
    });

    await s.apply(auth, 'alice', 'expired');
    await s.apply(connect, 'alice');
    await expectConverged(s);

    for (let i = 0; i < 5; i += 1) {
      await expectLiveNoteAt(s, 'bob', `drain-${i}`, { body: `d${i}` });
      await expectLiveNoteAt(s, 'alice', `drain-${i}`, { body: `d${i}` });
    }
  });

  test('revoked mid-push session wipes and detaches topics', async () => {
    await using s = await acmeSystem.script({
      seed: 604,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    await s.apply(mutate, 'alice', setNote, {
      id: 'n-before',
      body: 'visible',
    });
    await expectConverged(s);
    expect((await s.observe(subscribedTopics, 'alice')).length).toBeGreaterThan(
      0
    );

    await s.apply(auth, 'alice', 'revoked');
    await s.apply(mutate, 'bob', setNote, {
      id: 'n-late',
      body: 'after-revoke',
    });
    // nudge: revoke path may reject refresh — drive until topics detach.
    await s.apply(nudge, 'alice');
    await untilAcme(s, (s) => subscribedTopics(s, 'alice'), {
      maxMs: 2_000,
      pred: (t) => Array.isArray(t) && t.length === 0,
    });

    expect(await s.observe(subscribedTopics, 'alice')).toEqual([]);
    await expectLiveNoteAt(s, 'server', 'n-before', { body: 'visible' });
    await expectLiveNoteAt(s, 'bob', 'n-late', { body: 'after-revoke' });

    await s.apply(restart, 'alice', {});
    await expectConverged(s);
    await expectLiveNoteAt(s, 'alice', 'n-before', { body: 'visible' });
    await expectLiveNoteAt(s, 'alice', 'n-late', { body: 'after-revoke' });
    await expectNotesAgree(s, 'alice');
  });

  test('upgrade_required rejects without wiping local rows', async () => {
    await using s = await acmeSystem.script({
      seed: 605,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });

    await s.apply(mutate, 'alice', setNote, {
      id: 'n-keep',
      body: 'local-and-server',
    });
    await expectConverged(s);

    await s.apply(auth, 'alice', 'upgrade_required');
    await s.apply(disconnect, 'alice');
    await s.apply(connect, 'alice');
    await untilAcme(s, (s) => lastError(s, 'alice'), {
      maxMs: 2_000,
      pred: (e) => typeof e === 'string' && e.includes('upgrade_required'),
    });

    // Protocol cut must not wipe — local + server still hold the note.
    await expectLiveNoteAt(s, 'alice', 'n-keep', {
      body: 'local-and-server',
    });
    await expectLiveNoteAt(s, 'server', 'n-keep', {
      body: 'local-and-server',
    });
  });

  test('seq invariants skip a revoked client after server restart', async () => {
    await using s = await acmeSystem.script({
      seed: 606,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'c0' });
    await s.apply(addClient, { id: 'c1' });
    await s.apply(auth, 'c0', 'revoked');
    await s.apply(connect, 'c0');
    await s.apply(restart, 'server', { preserveLocalDb: true });
    expect(await s.observe(invariantViolations)).toEqual([]);
  });
});
