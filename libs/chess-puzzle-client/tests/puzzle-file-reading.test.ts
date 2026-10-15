import { expect, test } from 'bun:test';
import { readPuzzleFile } from '@libs/chess-puzzle-client/read-puzzle-file';
import { uploadPuzzleSource } from '@libs/chess-puzzle-client/upload-puzzle-source';

const CSV =
  'PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags\na,b,c,d,e,f,g,h,i,j\n';

// regression: lichess-file-native-stream
test.each(['csv', 'csv.zst'])(
  'reads a disk-backed .%s selection when its native stream fails before upload',
  async (extension) => {
    const bytes = new TextEncoder().encode(CSV);
    const file = new File(
      [
        extension === 'csv.zst'
          ? new Uint8Array(Bun.zstdCompressSync(bytes))
          : bytes,
      ],
      `lichess_db_puzzle.${extension}`
    );
    Object.defineProperty(file, 'stream', {
      value: () => {
        throw new TypeError('network error');
      },
    });
    const parts: string[] = [];
    expect(
      await uploadPuzzleSource(
        file,
        {
          uploadId: 'disk-backed-file',
          signal: new AbortController().signal,
          onProgress: () => undefined,
        },
        async (_id, _part, csv) => {
          parts.push(csv);
        }
      )
    ).toBe(1);
    expect(parts).toEqual([CSV]);
  }
);

test('reads a large selection in bounded ranges and stops reading on cancellation', async () => {
  const file = new File([new Uint8Array(5 * 1024 * 1024)], 'lichess.csv');
  const slice = file.slice.bind(file);
  const ranges: number[] = [];
  Object.defineProperty(file, 'slice', {
    value: (start: number, end: number) => {
      ranges.push(end - start);
      return slice(start, end);
    },
  });
  const reader = readPuzzleFile(file).getReader();
  const first = await reader.read();
  expect(first.done).toBe(false);
  expect(first.value?.byteLength).toBeLessThan(file.size);
  expect(ranges).toHaveLength(1);
  await reader.cancel();
  expect((await reader.read()).done).toBe(true);
  expect(ranges).toHaveLength(1);
});

test('explains a device file read failure without attributing it to the upload network', async () => {
  const file = new File([CSV], 'lichess_db_puzzle.csv.zst');
  Object.defineProperty(file, 'slice', {
    value: () => {
      throw new TypeError('network error');
    },
  });
  await expect(readPuzzleFile(file).getReader().read()).rejects.toThrow(
    'Could not read the selected Lichess file from this device'
  );
});
