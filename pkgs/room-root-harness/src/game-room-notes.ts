import { createAttrNamespace } from '@pkgs/attribute-shared/attribute';
import type { Message } from '@pkgs/message-shared/message';
import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared/message';
import type { HandleResult, RoomState } from '@pkgs/room-root-shared/types';

/**
 * The game room's sealed notes: a person seals a note for someone in the
 * room, and only that someone ever reads it. The room keeps every note;
 * everyone else's copy of the room holds no trace of its words.
 */

type Note = { readonly to: string; readonly text: string };

function isNote(p: unknown): p is Note {
  return (
    isPlainRecord(p) &&
    typeof p['to'] === 'string' &&
    p['to'].length > 0 &&
    typeof p['text'] === 'string' &&
    p['text'].length > 0
  );
}

const notesAttr = createAttrNamespace('game-room').json(
  'sealed-notes',
  (v): Readonly<Record<string, readonly string[]>> =>
    isPlainRecord(v) ? (v as Record<string, readonly string[]>) : {}
);

export const SealNote = createMessageNamespace('game-room-cmd')(
  'seal-note',
  isNote
);

export const NoteSealed = createMessageNamespace('game-room-evt')(
  'note-sealed',
  isNote
);

export function initialNotes(): RoomState {
  return notesAttr({});
}

export function handleNote(msg: Message): HandleResult | null {
  if (!SealNote.is(msg)) return null;
  return { ok: true, events: [NoteSealed(msg.payload)] };
}

export function reduceNote(state: RoomState, event: Message): RoomState | null {
  if (!NoteSealed.is(event)) return null;
  const notes = notesAttr.from(state);
  const { to, text } = event.payload;
  return {
    ...state,
    ...notesAttr({ ...notes, [to]: [...(notes[to] ?? []), text] }),
  };
}

/** Only the person a note is sealed for reads it; every other event is public. */
export function noteAudience(event: Message): readonly string[] | null {
  return NoteSealed.is(event) ? [event.payload.to] : null;
}

/** The notes sealed for `person`, as this copy of the room holds them. */
export function readNotes(state: RoomState, person: string): readonly string[] {
  return notesAttr.from(state)[person] ?? [];
}
