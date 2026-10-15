import { Decompress } from 'fzstd';
import { readPuzzleFile } from './read-puzzle-file';

/** Streaming Zstandard keeps the full database out of browser memory. */
export function puzzleFileStream(
  file: File,
  onRead?: (bytes: number) => void
): ReadableStream<Uint8Array> {
  const input = readPuzzleFile(file, onRead);
  if (!file.name.toLowerCase().endsWith('.zst')) return input;
  const reader = input.getReader();
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
