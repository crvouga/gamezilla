/**
 * Notes: writing, deleting, announcements, and what each person sees. A note
 * is identified by its title. A person in a shared space writes into it.
 */

import { expect } from 'bun:test';
import { DST_FAULTS } from '@pkgs/sync-engine-harness-ts/faults';
import {
  goesBack,
  liveNote,
  liveNotes,
  noteBodies,
} from '@pkgs/sync-engine-harness-ts/reads';
import {
  brokerCrash,
  brokerRestart,
  netSet,
  pubsubFault,
} from '@pkgs/sync-engine-harness-ts/regression-random-faults-actions';
import { lastMutationFailures } from '@pkgs/sync-engine-harness-ts/sync-observations';
import { NOTES_ALL_TOPIC } from '@pkgs/sync-engine-harness-ts/topics';
import {
  removeNote,
  SETTLE_MS,
  settledWrite,
  writeAnnouncement,
  writeNote,
} from './note-writes';
import type { SyncWorld } from './world';
import { app, ensureDevice, Given, Then, When } from './world';

/** How long "does not see" holds once things have settled. */
const QUIET_MS = 3_000;
/** How long live updates stop for. */
const PAUSE_MS = 500;
/** How often "never without its text" looks: finer than a live update. */
const BLANK_POLL_MS = 5;
/** How many notes each person writes, one right after another, when they keep writing. */
const KEEP_WRITING_ROUNDS = 10;

When(
  '{actor} writes the note {string} saying {string}',
  (w, actor: string, title: string, body: string) =>
    writeNote(w, app(actor), { title, body })
);

Given(
  '{actor} has written the note {string} saying {string}',
  async (w, actor: string, title: string, body: string) => {
    await writeNote(w, app(actor), { title, body });
    await settledWrite(w, app(actor), { title, deleted: false });
  }
);

When('{actor} deletes the note {string}', (w, actor: string, title: string) =>
  removeNote(w, app(actor), title)
);

async function hasDeleted(w: SyncWorld, actor: string, title: string) {
  await removeNote(w, app(actor), title);
  await settledWrite(w, app(actor), { title, deleted: true });
}

Given(
  '{actor} has deleted the note {string}',
  (w, actor: string, title: string) => hasDeleted(w, actor, title)
);

Given(
  '{actor} has deleted the note {string} before anyone wrote it',
  (w, actor: string, title: string) => hasDeleted(w, actor, title)
);

Given(
  '{actor} has written the notes {string} and {string}',
  async (w, actor: string, first: string, second: string) => {
    for (const title of [first, second]) {
      await writeNote(w, app(actor), { title, body: '' });
      await settledWrite(w, app(actor), { title, deleted: false });
    }
  }
);

Then(
  '{actor} and {actor} agree on every note',
  async (w, a: string, b: string) => {
    const [mine, theirs] = await w.s.until(
      async (s) => [await liveNotes(s, a), await liveNotes(s, b)] as const,
      {
        maxMs: SETTLE_MS,
        pred: ([x, y]) => JSON.stringify(x) === JSON.stringify(y),
      }
    );
    expect(mine).toEqual(theirs);
  }
);

Given(
  'the note {string} has reached {actor}',
  async (w, title: string, actor: string) => {
    await w.s.until((s) => liveNote(s, actor, title), {
      maxMs: SETTLE_MS,
      pred: (row) => row !== null && row.deletedAt === null,
    });
  }
);

When(
  '{actor} writes the announcement {string} saying {string}',
  (w, actor: string, title: string, body: string) =>
    writeAnnouncement(w, app(actor), { title, body })
);

Given(
  '{actor} has tried to write the announcement {string} saying {string}',
  (w, actor: string, title: string, body: string) =>
    writeAnnouncement(w, app(actor), { title, body })
);

Then(
  '{actor} is told announcements need a connection',
  async (w, actor: string) => {
    expect(await w.s.read(lastMutationFailures, actor)).toContain('OFFLINE');
  }
);

Then(
  '{actor} sees the note {string} at once',
  async (w, actor: string, title: string) => {
    const row = await w.s.read(liveNote, actor, title);
    expect(row).toMatchObject({ title, deletedAt: null });
  }
);

Then(
  '{actor} (still )sees the note {string} saying {string}',
  async (w, actor: string, title: string, body: string) => {
    const row = await w.s.until((s) => liveNote(s, actor, title), {
      maxMs: SETTLE_MS,
      pred: (r) => r !== null && r.deletedAt === null && r.body === body,
    });
    expect(row).toMatchObject({ title, body, deletedAt: null });
  }
);

Then(
  '{actor} does not see the note {string}',
  async (w, actor: string, title: string) => {
    const live = (row: unknown) =>
      row !== null && (row as { deletedAt: string | null }).deletedAt === null;
    await w.s.until((s) => liveNote(s, actor, title), {
      maxMs: SETTLE_MS,
      pred: (row) => !live(row),
    });
    await w.s.never((s) => liveNote(s, actor, title), {
      forMs: QUIET_MS,
      pred: live,
    });
  }
);

Then(
  '{actor} sees the note {string} once',
  async (w, actor: string, title: string) => {
    await w.s.until((s) => liveNote(s, actor, title), {
      maxMs: SETTLE_MS,
      pred: (row) => row !== null && row.deletedAt === null,
    });
    const rows = await w.s.read(liveNotes, actor);
    expect(rows.filter((row) => row.id === title)).toHaveLength(1);
  }
);

Given('live updates have stopped for a while and started again', async (w) => {
  await w.s.apply(brokerCrash);
  await w.s.advanceTime(PAUSE_MS);
  await w.s.apply(brokerRestart);
});

/**
 * The next live update on the channel every device hears loses its note's
 * text and title on the way (Bob's device hears it; the writer does not).
 */
Given(
  'the next live update to {actor} will arrive garbled',
  (w, _actor: string) =>
    w.s.apply(pubsubFault, {
      kind: 'corruptPubsubPayload',
      variant: 'flipField',
      topic: NOTES_ALL_TOPIC,
    })
);

/** Checked often on the run's clock while the note arrives. */
Then(
  '{actor} never sees the note {string} without its text',
  async (w, actor: string, title: string) => {
    await w.s.never((s) => liveNote(s, actor, title), {
      forMs: QUIET_MS,
      stepMs: BLANK_POLL_MS,
      pred: (row) => row !== null && (row.body === null || row.body === ''),
    });
  }
);

/** Only live updates suffer: fetching what was missed still works. */
Given(
  'live updates to {actor} and {actor} are lost, repeated and delayed at random',
  async (w, a: string, b: string) => {
    for (const actor of [a, b]) {
      const id = await ensureDevice(w, app(actor));
      await w.s.apply(netSet, id, 'live', DST_FAULTS);
    }
  }
);

/**
 * Each person keeps rewriting a note of their own, so every body a note
 * shows is newer than the last one it showed.
 */
When(
  '{actor} and {actor} keep writing notes',
  async (w, a: string, b: string) => {
    const watch = goesBack();
    w.noteWatch = watch;
    watch(await w.s.read(noteBodies, [a, b]));
    for (let round = 1; round <= KEEP_WRITING_ROUNDS; round += 1) {
      for (const actor of [a, b]) {
        await writeNote(w, app(actor), {
          title: `${actor}-note`,
          body: `${actor} ${String(round)}`,
        });
        watch(await w.s.read(noteBodies, [a, b]));
      }
    }
  }
);

Then(
  'neither {actor} nor {actor} ever sees a note go back to what it said before',
  async (w, a: string, b: string) => {
    const watch = w.noteWatch;
    if (watch === null)
      throw new Error('Note observation must start before writing');
    expect(watch.wentBack()).toBeNull();
    await w.s
      .never((s) => noteBodies(s, [a, b]), {
        forMs: QUIET_MS,
        stepMs: BLANK_POLL_MS,
        pred: watch,
      })
      .catch((error: unknown) => {
        throw new Error(`${String(watch.wentBack())}: ${String(error)}`);
      });
    // Not vacuous: the notes did move on while watched.
    expect(watch.changes()).toBeGreaterThan(0);
    expect(await w.s.read(noteBodies, [a, b])).toMatchObject({
      [`${a}/${b}-note`]: `${b} ${KEEP_WRITING_ROUNDS}`,
      [`${b}/${a}-note`]: `${a} ${KEEP_WRITING_ROUNDS}`,
    });
  }
);
