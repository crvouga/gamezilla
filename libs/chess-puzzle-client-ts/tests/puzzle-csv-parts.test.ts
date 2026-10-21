import { expect, test } from 'bun:test';
import {
  puzzleCsvParts,
  puzzleCsvRecords,
} from '@libs/chess-puzzle-client-ts/puzzle-csv-parts';
import { puzzleFileStream } from '@libs/chess-puzzle-client-ts/puzzle-file-stream';
import { uploadPuzzleSource } from '@libs/chess-puzzle-client-ts/upload-puzzle-source';

const HEADER =
  'PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags';
function stream(text: string, chunkSize = 7): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.slice(offset, offset + chunkSize));
      offset += chunkSize;
    },
  });
}
async function collect<T>(source: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = [];
  for await (const value of source) values.push(value);
  return values;
}

test('record framing survives quoted newlines, escaped quotes, CRLF, and split UTF-8', async () => {
  expect(
    await collect(puzzleCsvRecords(stream('a,"b\nç"\r\n"c""d",e\nlast,row', 1)))
  ).toEqual(['a,"b\nç"', '"c""d",e', 'last,row']);
});

test('source parts preserve current and historical Lichess headers and bound each upload', async () => {
  const parts = await collect(
    puzzleCsvParts(
      stream(
        `\uFEFF${HEADER},DailyDate\r\n${Array.from({ length: 501 }, (_, id) => `${id},fen,moves,1200,80,50,10,mate,,,`).join('\r\n')}`
      )
    )
  );
  expect(parts.map((part) => part.rows)).toEqual([250, 250, 1]);
  expect(
    parts.every((part) => part.csv.startsWith(`${HEADER},DailyDate\n`))
  ).toBe(true);
  expect(
    (await collect(puzzleCsvParts(stream(`${HEADER}\na,b,c,d,e,f,g,h,i,j`))))[0]
      ?.rows
  ).toBe(1);
});

test('refuses wrong headers, truncated CSV and excessive records', async () => {
  await expect(collect(puzzleCsvParts(stream('id,fen\na,b')))).rejects.toThrow(
    'original header'
  );
  await expect(
    collect(puzzleCsvParts(stream(`${HEADER}\n"unfinished`)))
  ).rejects.toThrow('quoted field');
  await expect(
    collect(puzzleCsvParts(stream(`${HEADER}\n${'x'.repeat(16_001)}`)))
  ).rejects.toThrow('oversized record');
  await expect(collect(puzzleCsvParts(stream('')))).rejects.toThrow('empty');
});

test.each(['csv', 'csv.zst'])(
  'uploads a Lichess .%s file through the CSV pipeline',
  async (extension) => {
    const csv = `${HEADER}\na,b,c,d,e,f,g,h,i,j\n`;
    const bytes = new TextEncoder().encode(csv);
    const file = new File(
      [
        extension === 'csv.zst'
          ? new Uint8Array(Bun.zstdCompressSync(bytes))
          : bytes,
      ],
      `lichess_db_puzzle.${extension}`
    );
    expect(await collect(puzzleCsvParts(puzzleFileStream(file)))).toEqual([
      { csv, rows: 1 },
    ]);
    const uploads: { id: string; part: number; csv: string }[] = [];
    const progress: number[] = [];
    const chunks = await uploadPuzzleSource(
      file,
      {
        uploadId: 'lichess-source',
        signal: new AbortController().signal,
        onProgress: () => undefined,
        onFileProgress: (fraction) => progress.push(fraction),
      },
      async (id, part, value) => {
        expect(progress).toEqual([]);
        uploads.push({ id, part, csv: value });
      }
    );
    expect(chunks).toBe(1);
    expect(uploads).toEqual([{ id: 'lichess-source', part: 0, csv }]);
    expect(progress).toEqual([0.99]);
  }
);

test('stopping an upload closes the source without sending later parts', async () => {
  const controller = new AbortController();
  const file = new File(
    [
      `${HEADER}\n${Array.from({ length: 501 }, (_, id) => `${id},fen,moves,1200,80,50,10,mate,,`).join('\n')}`,
    ],
    'lichess.csv'
  );
  const sent: number[] = [];
  const progress: number[] = [];
  await expect(
    uploadPuzzleSource(
      file,
      {
        uploadId: 'cancelled',
        signal: controller.signal,
        onProgress: (rows) => {
          progress.push(rows);
        },
      },
      async (_id, part) => {
        sent.push(part);
        controller.abort();
      }
    )
  ).rejects.toThrow();
  expect(sent).toEqual([0]);
  expect(progress).toEqual([250]);
});
