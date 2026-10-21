import {
  puzzleSourcePartKey,
  puzzleSourcePrefix,
} from '@libs/chess-puzzle-shared-ts/puzzle-load-job';
import {
  SAVED_PUZZLE_SOURCE_KEY,
  type SavedPuzzleSource,
  savedPuzzleSourceSchema,
} from '@libs/chess-puzzle-shared-ts/puzzle-source';
import { readUtf8, writeUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';

/** The file is published only after all bounded CSV parts have arrived. */
export class SavedPuzzleSourceStore {
  constructor(private readonly store: ObjectStore) {}

  async read(): Promise<SavedPuzzleSource | null> {
    const value = await readUtf8(this.store, SAVED_PUZZLE_SOURCE_KEY);
    return value === null
      ? null
      : savedPuzzleSourceSchema.parse(JSON.parse(value));
  }

  async save(input: SavedPuzzleSource): Promise<SavedPuzzleSource> {
    const source = savedPuzzleSourceSchema.parse(input);
    const existing = await this.read();
    if (existing !== null) return existing;
    const parts = new Set(
      await this.store.listKeys(puzzleSourcePrefix(source.id))
    );
    for (let part = 0; part < source.chunks; part += 1) {
      if (!parts.has(puzzleSourcePartKey(source.id, part)))
        throw new Error(
          'The Lichess file upload is incomplete. Choose the file again.'
        );
    }
    // Every version remains immutable. An importing environment pins its part path,
    // so simultaneous first uploads cannot change the bytes of an ongoing import.
    await writeUtf8(
      this.store,
      SAVED_PUZZLE_SOURCE_KEY,
      JSON.stringify(source),
      'application/json'
    );
    return source;
  }
}
