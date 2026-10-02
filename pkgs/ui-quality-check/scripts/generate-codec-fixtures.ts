// @io-wall-ok — small deterministic-input decoder contract fixture generator.
import { mkdir, writeFile } from 'node:fs/promises';
import { startProcess } from '@pkgs/os/streaming-process';
import ffmpeg from 'ffmpeg-static';

await mkdir('fixtures/codecs', { recursive: true });
const process = startProcess({
  command: ffmpeg ?? 'ffmpeg',
  args: [
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    'color=c=0x4080ff:s=64x64:r=30',
    '-t',
    '50',
    '-an',
    '-c:v',
    'libvpx',
    '-threads',
    '1',
    '-f',
    'webm',
    'pipe:1',
  ],
});
const read = async (stream: AsyncIterable<Uint8Array>) => {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
};
try {
  const [stdout, stderr, code] = await Promise.all([
    read(process.stdout),
    read(process.stderr),
    process.completed,
  ]);
  if (code !== 0) throw new Error(stderr.toString());
  await writeFile('fixtures/codecs/grid-30fps.webm', stdout);
  await writeFile('fixtures/codecs/corrupt.webm', 'not a video');
} finally {
  process.stop();
  await process.completed;
}

const short = startProcess({
  command: ffmpeg ?? 'ffmpeg',
  args: [
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    'color=c=white:s=64x64:r=60',
    '-frames:v',
    '3',
    '-vf',
    "drawbox=color=black:t=fill:enable='eq(n,1)'",
    '-an',
    '-c:v',
    'libx264',
    '-threads',
    '1',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    'frag_keyframe+empty_moov',
    '-f',
    'mp4',
    'pipe:1',
  ],
});
try {
  const [stdout, stderr, code] = await Promise.all([
    read(short.stdout),
    read(short.stderr),
    short.completed,
  ]);
  if (code !== 0) throw new Error(stderr.toString());
  await writeFile('fixtures/codecs/rounded-timestamp.mp4', stdout);
} finally {
  short.stop();
  await short.completed;
}
