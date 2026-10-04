import { PassThrough, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { assert } from '@pkgs/assert-root-shared/singleton';
import { parse } from 'csv-parse';
import type { ResolvedSource } from './streaming';
import { ZstdDecodeTransform } from './zstd-decode-transform';

export type IteratePuzzleRowsOptions = {
  onParsedRowCount?: (args: { parsedRows: number }) => void;
  /** Emit parse progress every N CSV rows (default 25_000). */
  progressEveryDataRows?: number;
};

function isAbortError(error: unknown): boolean {
  if (error === null || typeof error !== 'object') return false;
  const e = error as { code?: unknown; name?: unknown };
  return e.code === 'ABORT_ERR' || e.name === 'AbortError';
}

/**
 * Streams puzzle CSV rows from a resolved archive. Construct at the call site —
 * do not export free functions that take ObjectStore (via ResolvedSource).
 */
export class PuzzleRowIterator {
  async iterate(
    resolved: ResolvedSource,
    onRow: (row: Record<string, unknown>) => Promise<boolean>,
    options?: IteratePuzzleRowsOptions
  ): Promise<void> {
    const obj = await resolved.store.get(resolved.key);
    assert.defined(obj, 'seed:puzzles: resolved source disappeared', {
      key: resolved.key,
      displayPath: resolved.displayPath,
    });
    const fileStream = Readable.fromWeb(
      obj.body as unknown as NodeReadableStream
    );
    const decode = resolved.isZst
      ? new ZstdDecodeTransform()
      : new PassThrough();
    const parser = parse({
      columns: true,
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
    });

    const every = options?.progressEveryDataRows ?? 25_000;
    let parsedRows = 0;
    // `stopRequested` is set when the row callback returns `false` (e.g.
    // `--limit` reached). Returning early from the consumer destroys the
    // parser before its writable side ends, which makes `pipeline()` reject
    // with `ABORT_ERR` on Node and Bun. We swallow exactly that case below
    // so a user-requested early stop is not surfaced as a stream abort and,
    // crucially, so it does not mask a real downstream error from `onRow`.
    let stopRequested = false;
    let rowCallbackError: unknown = null;
    try {
      await pipeline(
        fileStream,
        decode,
        parser,
        async (records: AsyncIterable<Record<string, unknown>>) => {
          for await (const record of records) {
            parsedRows += 1;
            if (
              options?.onParsedRowCount !== undefined &&
              parsedRows % every === 0
            ) {
              options.onParsedRowCount({ parsedRows });
            }
            let cont: boolean;
            try {
              cont = await onRow(record);
            } catch (err) {
              // Capture the real error so we can rethrow it after pipeline
              // unwinds — otherwise `pipeline()` may surface a bare
              // `ABORT_ERR` from cleanup that hides the original cause.
              rowCallbackError = err;
              stopRequested = true;
              return;
            }
            if (!cont) {
              stopRequested = true;
              return;
            }
          }
        }
      );
    } catch (err) {
      if (rowCallbackError !== null) throw rowCallbackError;
      if (stopRequested && isAbortError(err)) return;
      throw err;
    }
    if (rowCallbackError !== null) throw rowCallbackError;
  }
}
