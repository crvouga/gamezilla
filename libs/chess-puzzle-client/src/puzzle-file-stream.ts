import { Decompress } from 'fzstd';
import { readPuzzleFile } from './read-puzzle-file';

/** Streaming Zstandard keeps the full database out of browser memory. */
export function puzzleFileStream(file: File): ReadableStream<Uint8Array> {
  if (!file.name.toLowerCase().endsWith('.zst')) return readPuzzleFile(file);
  const reader = readPuzzleFile(file).getReader();
  let decompressor: Decompress;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      decompressor = new Decompress((chunk) => {
        if (chunk.byteLength > 0) controller.enqueue(chunk);
      });
    },
    async pull(controller) {
      try {
        const next = await reader.read();
        decompressor.push(next.value ?? new Uint8Array(), next.done);
        if (next.done) {
          reader.releaseLock();
          controller.close();
        }
      } catch (error) {
        await reader.cancel();
        controller.error(error);
      }
    },
    async cancel() {
      await reader.cancel();
    },
  });
}
