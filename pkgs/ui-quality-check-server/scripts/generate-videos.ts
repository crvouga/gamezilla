// @io-wall-ok — benchmark recording authoring, independent of any test runner.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { startProcess } from '@pkgs/os-server/streaming-process';
import ffmpeg from 'ffmpeg-static';
import { captureProcess } from '@pkgs/ui-quality-check-server/process';

if (!ffmpeg) throw new Error('Bundled FFmpeg is missing.');
const directory = process.argv[2] ?? '.cache/benchmark-videos';
await mkdir(directory, { recursive: true });
const families = [
  'desktop',
  'mobile',
  'dialog',
  'chessboard',
  'dense',
  'loading',
  'wrapped-text',
  'compact',
];
for (let i = 0; i < 12; i++) {
  const family = families[i % families.length] ?? 'desktop';
  const paths = [
    resolve(`fixtures/evaluation/good/${family}.png`),
    resolve(`fixtures/evaluation/bad/${family}-duplicate.png`),
    resolve(`fixtures/evaluation/good/${family}.png`),
  ];
  const list =
    paths
      .map(
        (path, j) =>
          `file '${path.replace(/'/g, "'\\''")}'\nduration ${j === 1 ? 1 : 24.5}`
      )
      .join('\n') + `\nfile '${paths[2]}'\n`;
  const listPath = `${directory}/source-${i}.txt`;
  await writeFile(listPath, list);
  const output = `${directory}/recording-${i}.${i % 2 ? 'mp4' : 'webm'}`;
  const codec =
    i % 2
      ? ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '25']
      : ['-c:v', 'libvpx-vp9', '-cpu-used', '8', '-crf', '32', '-b:v', '0'];
  await captureProcess(startProcess, {
    command: ffmpeg,
    args: [
      '-hide_banner',
      '-loglevel',
      'error',
      '-nostdin',
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      listPath,
      '-vf',
      'fps=30,tpad=stop_mode=clone:stop_duration=25',
      '-fps_mode',
      'cfr',
      '-t',
      '50',
      ...codec,
      '-threads',
      '2',
      '-pix_fmt',
      'yuv420p',
      output,
    ],
  });
}
console.log(`Created 12 recordings totaling 10 minutes in ${directory}.`);
