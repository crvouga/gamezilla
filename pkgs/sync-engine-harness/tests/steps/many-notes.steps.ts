/**
 * Many notes at once: a long offline session filing notes in new folders,
 * and one change to many notes. Note and folder ids are numbered so their
 * order is the order they were written.
 */

import { expect } from 'bun:test';
import { liveFolders, liveNotes } from '@pkgs/sync-engine-harness/reads';
import { mutate } from '@pkgs/sync-engine-harness/regression-actions';
import { retouchNotes } from '@pkgs/sync-engine-harness/hardening-fixtures';
import { setFolder, setNote } from '@pkgs/sync-engine-harness/mutations';
import { SETTLE_MS } from './note-writes';
import { app, ensureDevice, Given, Then, When } from './world';

const pad = (i: number): string => String(i).padStart(3, '0');
const noteIds = (count: number): string[] =>
  Array.from({ length: count }, (_, i) => `note-${pad(i)}`);
const folderOf = (noteId: string): string => noteId.replace('note-', 'folder-');

Given(
  '{actor} has filed {int} notes offline, each in a new folder made just before it',
  async (w, actor: string, count: number) => {
    const id = await ensureDevice(w, app(actor));
    for (const note of noteIds(count)) {
      const folder = folderOf(note);
      await w.s.apply(mutate, id, setFolder, { id: folder, title: folder });
      await w.s.apply(mutate, id, setNote, {
        id: note,
        title: note,
        body: note,
        folderId: folder,
      });
    }
  }
);

Then(
  '{actor} sees all {int} notes, each in its folder',
  async (w, actor: string, count: number) => {
    const id = await ensureDevice(w, app(actor));
    const notes = await w.s.until((s) => liveNotes(s, id), {
      maxMs: SETTLE_MS,
      pred: (rows) => rows.length === count,
    });
    const folders = await w.s.read(liveFolders, id);
    expect(folders.map((folder) => folder.id)).toEqual(
      noteIds(count).map(folderOf)
    );
    expect(notes.map((note) => [note.id, note.folderId])).toEqual(
      noteIds(count).map((note) => [note, folderOf(note)])
    );
  }
);

Given(
  '{actor} has written {int} notes that have reached {actor}',
  async (w, writer: string, count: number, reader: string) => {
    const writerId = await ensureDevice(w, app(writer));
    const readerId = await ensureDevice(w, app(reader));
    for (const note of noteIds(count)) {
      await w.s.apply(mutate, writerId, setNote, {
        id: note,
        title: note,
        body: note,
      });
    }
    await w.s.until((s) => liveNotes(s, readerId), {
      maxMs: SETTLE_MS,
      pred: (rows) => rows.length === count,
    });
  }
);

When(
  '{actor} changes all {int} notes at once to say {string}',
  async (w, actor: string, count: number, body: string) => {
    const id = await ensureDevice(w, app(actor));
    await w.s.apply(mutate, id, retouchNotes, { ids: noteIds(count), body });
  }
);

Then(
  '{actor} sees all {int} notes saying {string}',
  async (w, actor: string, count: number, body: string) => {
    const id = await ensureDevice(w, app(actor));
    const notes = await w.s.until((s) => liveNotes(s, id), {
      maxMs: SETTLE_MS,
      pred: (rows) =>
        rows.length === count && rows.every((row) => row.body === body),
    });
    expect(notes.map((note) => [note.id, note.body])).toEqual(
      noteIds(count).map((note) => [note, body])
    );
  }
);

Then(
  '{actor} sees exactly {int} notes',
  async (w, actor: string, count: number) => {
    const id = await ensureDevice(w, app(actor));
    expect(await w.s.read(liveNotes, id)).toHaveLength(count);
  }
);
