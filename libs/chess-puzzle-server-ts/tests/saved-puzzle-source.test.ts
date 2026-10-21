import { expect, test } from 'bun:test';
import { SavedPuzzleSourceStore } from '@libs/chess-puzzle-server-ts/saved-puzzle-source';
import { puzzleSourcePartKey } from '@libs/chess-puzzle-shared-ts/puzzle-load-job';
import { SAVED_PUZZLE_SOURCE_KEY } from '@libs/chess-puzzle-shared-ts/puzzle-source';
import { writeUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';

test('an incomplete file is not published and a completed file can be reused by another environment', async () => {
  const objects = new ObjectStoreImplInMemory();
  const first = new SavedPuzzleSourceStore(objects);
  const other = new SavedPuzzleSourceStore(objects);
  const source = {
    id: 'lichess-first',
    filename: 'lichess.csv.zst',
    chunks: 2,
  };
  expect(await other.read()).toBeNull();
  await writeUtf8(objects, puzzleSourcePartKey(source.id, 0), 'first CSV part');
  await expect(first.save(source)).rejects.toThrow('upload is incomplete');
  expect(await objects.head(SAVED_PUZZLE_SOURCE_KEY)).toBe(false);
  await writeUtf8(
    objects,
    puzzleSourcePartKey(source.id, 1),
    'second CSV part'
  );
  expect(await first.save(source)).toEqual(source);
  expect(await other.read()).toEqual(source);
  const later = { id: 'lichess-later', filename: 'other.csv', chunks: 1 };
  expect(await other.save(later)).toEqual(source);
  expect(await first.read()).toEqual(source);
  expect(await objects.head(puzzleSourcePartKey(source.id, 0))).toBe(true);
});
