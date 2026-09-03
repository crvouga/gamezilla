import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
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
  syncVirtualHost,
  untilAcme,
} from '../apps/acme';

describe('auth revoked wipes db expired refreshes', () => {
  test('expired token refreshes; held queue drains and converges', async () => {
    await using run = await script(acmeSystem, {
      seed: 601,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    await run.apply(disconnect, 'alice');
    await run.apply(mutate, 'alice', setNote, {
      id: 'n-exp',
      body: 'queued-through-refresh',
    });
    await neverAcme(run, liveNote('server', 'n-exp'), { forMs: 50 });

    await run.apply(auth, 'alice', 'expired');
    await run.apply(connect, 'alice');
    await expectConverged(run);

    await expectLiveNoteAt(run, 'bob', 'n-exp', {
      body: 'queued-through-refresh',
    });
    await expectLiveNoteAt(run, 'alice', 'n-exp', {
      body: 'queued-through-refresh',
    });
  });

  test('revoked wipe drops unuploaded optimistic edit; restart rehydrates server only', async () => {
    await using run = await script(acmeSystem, {
      seed: 602,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    await run.apply(mutate, 'alice', setNote, {
      id: 'n-kept',
      body: 'on-server',
    });
    await expectConverged(run);

    await run.apply(disconnect, 'alice');
    await run.apply(mutate, 'alice', setNote, {
      id: 'n-lost',
      body: 'never-uploaded',
    });
    await neverAcme(run, liveNote('server', 'n-lost'), { forMs: 50 });

    await run.apply(auth, 'alice', 'revoked');
    await run.apply(connect, 'alice');
    await neverAcme(run, liveNote('server', 'n-lost'), { forMs: 500 });

    await run.apply(restart, 'alice', {});
    await expectConverged(run);

    await expectLiveNoteAt(run, 'alice', 'n-kept', { body: 'on-server' });
    await expectNoteNotLiveAt(run, 'alice', 'n-lost');
    await expectNoteNotLiveAt(run, 'server', 'n-lost');
  });

  test('expired during multi-mutation drain refreshes without loss', async () => {
    await using run = await script(acmeSystem, {
      seed: 603,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    await run.apply(disconnect, 'alice');
    for (let i = 0; i < 5; i += 1) {
      await run.apply(mutate, 'alice', setNote, {
        id: `drain-${i}`,
        body: `d${i}`,
      });
    }
    await neverAcme(run, liveNote('server', 'drain-0'), { forMs: 50 });

    await run.apply(auth, 'alice', 'expired');
    await run.apply(connect, 'alice');
    await expectConverged(run);

    for (let i = 0; i < 5; i += 1) {
      await expectLiveNoteAt(run, 'bob', `drain-${i}`, { body: `d${i}` });
      await expectLiveNoteAt(run, 'alice', `drain-${i}`, { body: `d${i}` });
    }
  });

  test('revoked mid-push session wipes and detaches topics', async () => {
    await using run = await script(acmeSystem, {
      seed: 604,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    await run.apply(mutate, 'alice', setNote, {
      id: 'n-before',
      body: 'visible',
    });
    await expectConverged(run);
    expect(
      (await run.observe(subscribedTopics('alice'))).length
    ).toBeGreaterThan(0);

    await run.apply(auth, 'alice', 'revoked');
    await run.apply(mutate, 'bob', setNote, {
      id: 'n-late',
      body: 'after-revoke',
    });
    // nudge: revoke path may reject refresh — drive until topics detach.
    await run.apply(nudge, 'alice');
    await untilAcme(run, subscribedTopics('alice'), {
      maxMs: 2_000,
      pred: (t) => Array.isArray(t) && t.length === 0,
    });

    expect(await run.observe(subscribedTopics('alice'))).toEqual([]);
    await expectLiveNoteAt(run, 'server', 'n-before', { body: 'visible' });
    await expectLiveNoteAt(run, 'bob', 'n-late', { body: 'after-revoke' });

    await run.apply(restart, 'alice', {});
    await expectConverged(run);
    await expectLiveNoteAt(run, 'alice', 'n-before', { body: 'visible' });
    await expectLiveNoteAt(run, 'alice', 'n-late', { body: 'after-revoke' });
    await expectNotesAgree(run, 'alice');
  });

  test('upgrade_required rejects without wiping local rows', async () => {
    await using run = await script(acmeSystem, {
      seed: 605,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });

    await run.apply(mutate, 'alice', setNote, {
      id: 'n-keep',
      body: 'local-and-server',
    });
    await expectConverged(run);

    await run.apply(auth, 'alice', 'upgrade_required');
    await run.apply(disconnect, 'alice');
    await run.apply(connect, 'alice');
    await untilAcme(run, lastError('alice'), {
      maxMs: 2_000,
      pred: (e) => typeof e === 'string' && e.includes('upgrade_required'),
    });

    // Protocol cut must not wipe — local + server still hold the note.
    await expectLiveNoteAt(run, 'alice', 'n-keep', {
      body: 'local-and-server',
    });
    await expectLiveNoteAt(run, 'server', 'n-keep', {
      body: 'local-and-server',
    });
  });

  test('seq invariants skip a revoked client after server restart', async () => {
    await using run = await script(acmeSystem, {
      seed: 606,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'c0' });
    await run.apply(addClient, { id: 'c1' });
    await run.apply(auth, 'c0', 'revoked');
    await run.apply(connect, 'c0');
    await run.apply(restart, 'server', { preserveLocalDb: true });
    expect(await run.observe(invariantViolations)).toEqual([]);
  });
});
