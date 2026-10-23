import { PUZZLE_UPLOAD_MAX_BYTES } from '@libs/chess-puzzle-shared-ts/puzzle-load-job';
import { isLichessPuzzleHeader } from '@libs/chess-puzzle-shared-ts/puzzle-records';

const MAX_RECORD_CHARACTERS = 16_000;
const ROWS_PER_PART = 250;

/** CSV record boundaries, including quoted newlines and quotes split between chunks. */
export async function* puzzleCsvRecords(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const state = { record: '', quoted: false };
  try {
    for (;;) {
      const next = await reader.read();
      const text = next.done
        ? decoder.decode()
        : decoder.decode(next.value, { stream: true });
      yield* consumeCsvText(state, text);
      if (next.done) break;
    }
    if (state.quoted) throw new Error('The CSV ends inside a quoted field.');
    if (state.record.trim().length > 0) yield state.record.replace(/\r$/, '');
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}

type CsvState = { record: string; quoted: boolean };
function* consumeCsvText(state: CsvState, text: string): Generator<string> {
  for (const character of text) {
    if (character === '"') state.quoted = !state.quoted;
    if (character !== '\n' || state.quoted) {
      state.record += character;
      if (state.record.length > MAX_RECORD_CHARACTERS)
        throw new Error('The CSV contains an oversized record.');
      continue;
    }
    if (state.record.trim().length > 0) yield state.record.replace(/\r$/, '');
    state.record = '';
  }
}

/** Keep memory and upload requests bounded even for the full Lichess database. */
export async function* puzzleCsvParts(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<{ csv: string; rows: number }> {
  let header: string | null = null;
  let records: string[] = [];
  const encoder = new TextEncoder();
  for await (const record of puzzleCsvRecords(stream)) {
    if (header === null) {
      header = record.replace(/^\uFEFF/, '');
      if (!isLichessPuzzleHeader(header.split(',')))
        throw new Error(
          'Choose a Lichess puzzle database CSV with its original header.'
        );
      continue;
    }
    records.push(record);
    if (records.length < ROWS_PER_PART) continue;
    const csv = `${header}\n${records.join('\n')}\n`;
    if (encoder.encode(csv).byteLength > PUZZLE_UPLOAD_MAX_BYTES)
      throw new Error('The CSV contains an oversized source part.');
    yield { csv, rows: records.length };
    records = [];
  }
  if (header === null) throw new Error('The selected CSV is empty.');
  if (records.length > 0) {
    const csv = `${header}\n${records.join('\n')}\n`;
    if (encoder.encode(csv).byteLength > PUZZLE_UPLOAD_MAX_BYTES)
      throw new Error('The CSV contains an oversized source part.');
    yield { csv, rows: records.length };
  }
}
