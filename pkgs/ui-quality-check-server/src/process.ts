import type {
  ProcessRequest,
  StreamingProcess,
} from '@pkgs/os-server/streaming-process';

export type ProcessStarter = (request: ProcessRequest) => StreamingProcess;

export async function captureProcess(
  start: ProcessStarter,
  request: ProcessRequest,
  maxBytes = 32_000_000
) {
  const process = start(request);
  const read = async (stream: AsyncIterable<Uint8Array>) => {
    const parts: Uint8Array[] = [];
    let size = 0;
    for await (const part of stream) {
      size += part.length;
      if (size > maxBytes)
        throw new Error(`Decoder output exceeded ${maxBytes} bytes.`);
      parts.push(part);
    }
    return Buffer.concat(parts);
  };
  try {
    const [stdout, stderr, code] = await Promise.all([
      read(process.stdout),
      read(process.stderr),
      process.completed,
    ]);
    request.signal?.throwIfAborted();
    if (code !== 0)
      throw new Error(
        `FFmpeg failed (exit ${code}): ${stderr.toString().slice(-4000)}`
      );
    return { stdout, stderr: stderr.toString() };
  } catch (error) {
    request.signal?.throwIfAborted();
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      throw new Error(
        `FFmpeg is unavailable at ${request.command}. Enable installation scripts for ffmpeg-static or supply ffmpegPath / --ffmpeg.`,
        { cause: error }
      );
    throw error;
  } finally {
    process.stop();
    await process.completed.catch(() => undefined);
  }
}
