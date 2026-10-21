const READ_BYTES = 1024 * 1024;

/** Bounded slices avoid native whole-file stream failures on disk-backed files. */
export function readPuzzleFile(
  file: File,
  onRead?: (bytes: number) => void
): ReadableStream<Uint8Array> {
  let offset = 0;
  let cancelled = false;
  return new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        if (offset >= file.size) {
          controller.close();
          return;
        }
        const end = Math.min(offset + READ_BYTES, file.size);
        let bytes: Uint8Array;
        try {
          bytes = new Uint8Array(await file.slice(offset, end).arrayBuffer());
          if (bytes.byteLength !== end - offset)
            throw new Error(
              'The selected file changed or could not be read completely.'
            );
        } catch (cause) {
          if (!cancelled)
            controller.error(
              new Error(
                'Could not read the selected Lichess file from this device. Choose the downloaded file again and retry.',
                { cause }
              )
            );
          return;
        }
        if (cancelled) return;
        offset = end;
        onRead?.(offset);
        controller.enqueue(bytes);
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 }
  );
}
