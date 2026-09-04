import { canonicalJsonStringify } from '../../kernel/json';

/** In-memory note row — stands in for a SQL notes table. */
export type Note = {
  readonly id: string;
  readonly body: string;
};

export type NotesAgg = {
  readonly h: string;
  readonly n: number;
};

export function notesAgg(notes: Map<string, Note>): NotesAgg {
  const rows = [...notes.values()].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  );
  return {
    h: canonicalJsonStringify(rows),
    n: rows.length,
  };
}
