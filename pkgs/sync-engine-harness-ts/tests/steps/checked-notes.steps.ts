/**
 * Checked notes: a write the app reports only once everyone else has
 * answered (`pendingUx: 'pending'`). In the example app the rule only
 * everyone else can check is that a note may not say "refused".
 */

import { expect } from 'bun:test';
import { pendingNote } from '@pkgs/sync-engine-harness-ts/mutations';
import { liveNote } from '@pkgs/sync-engine-harness-ts/reads';
import { startMutate } from '@pkgs/sync-engine-harness-ts/regression-actions';
import {
  lastMutationFailures,
  lastMutationId,
  lastMutationOk,
  lastMutationSettled,
  outcome,
} from '@pkgs/sync-engine-harness-ts/sync-observations';
import { SETTLE_MS } from './note-writes';
import type { SyncWorld } from './world';
import { app, ensureDevice, Given, Then, When } from './world';

async function writeChecked(
  w: SyncWorld,
  actor: string,
  title: string,
  body: string
): Promise<void> {
  const id = await ensureDevice(w, app(actor));
  await w.s.apply(startMutate, id, pendingNote, { id: title, title, body });
}

/** Waits for the app's answer about the actor's last checked note. */
async function answer(w: SyncWorld, actor: string): Promise<void> {
  await w.s.until((s) => lastMutationSettled(s, actor), {
    maxMs: SETTLE_MS,
    pred: (settled) => settled,
  });
}

When(
  '{actor} writes the checked note {string} saying {string}',
  (w, actor: string, title: string, body: string) =>
    writeChecked(w, actor, title, body)
);

Given(
  '{actor} has written the checked note {string} saying {string}',
  async (w, actor: string, title: string, body: string) => {
    await writeChecked(w, actor, title, body);
    await answer(w, actor);
    expect(await w.s.read(lastMutationOk, actor)).toBe(true);
  }
);

Then(
  "{actor}'s app says the note {string} is still saving",
  async (w, actor: string, _title: string) => {
    expect(await w.s.read(lastMutationSettled, actor)).toBe(false);
  }
);

/** Saved: the app's answer is in, and it is the confirmation. */
Then(
  "{actor}'s app says the note {string} is saved",
  async (w, actor: string, _title: string) => {
    await answer(w, actor);
    expect(await w.s.read(lastMutationOk, actor)).toBe(true);
    const id = await w.s.read(lastMutationId, actor);
    if (id === null) throw new Error(`${actor} has no saved write`);
    expect(await w.s.read(outcome, actor, id)).toBe('confirmed');
  }
);

Then(
  '{actor} never sees the note {string} saying {string}',
  async (w, actor: string, title: string, body: string) => {
    await w.s.never((s) => liveNote(s, actor, title), {
      forMs: SETTLE_MS,
      stepMs: 1,
      pred: (note) => note?.deletedAt === null && note.body === body,
    });
  }
);

Then(
  "{actor}'s app says the note {string} was refused",
  async (w, actor: string, _title: string) => {
    await answer(w, actor);
    expect(await w.s.read(lastMutationOk, actor)).toBe(false);
    expect(await w.s.read(lastMutationFailures, actor)).toContain('REFUSED');
  }
);

/** No waiting after the answer: the device already shows the kept note. */
Then(
  "the moment {actor}'s app says the note {string} was refused, it shows the note saying {string}",
  async (w, actor: string, title: string, body: string) => {
    await answer(w, actor);
    expect(await w.s.read(lastMutationOk, actor)).toBe(false);
    const row = await w.s.read(liveNote, actor, title);
    expect(row).toMatchObject({ title, body, deletedAt: null });
  }
);
