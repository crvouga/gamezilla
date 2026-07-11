import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import {
  CURATED_SOUNDS,
  type CuratedSound,
} from './curate-mapping';

const ROOT = path.join(import.meta.dir, '..');
const ASSETS = path.join(ROOT, 'assets');
const STAGING = path.join(ROOT, '.cache', 'kenney', 'staging');

function isStinger(sound: CuratedSound): boolean {
  return sound.tags.includes('stinger');
}

function loudnessTarget(sound: CuratedSound): number {
  return isStinger(sound) ? -16 : -18;
}

async function convertSource(
  sourcePath: string,
  destPath: string,
  targetLufs: number
): Promise<void> {
  await mkdir(path.dirname(destPath), { recursive: true });
  const proc = Bun.spawn(
    [
      'ffmpeg',
      '-y',
      '-i',
      sourcePath,
      '-af',
      `silenceremove=start_periods=1:start_silence=0.01:start_threshold=-50dB,loudnorm=I=${targetLufs}:TP=-1:LRA=7`,
      '-ar',
      '44100',
      '-ac',
      '1',
      '-codec:a',
      'libmp3lame',
      '-qscale:a',
      '2',
      destPath,
    ],
    { stdout: 'pipe', stderr: 'pipe' }
  );
  const code = await proc.exited;
  if (code !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(`ffmpeg failed for ${sourcePath}: ${err}`);
  }
}

function resolveSource(relativeSource: string): string {
  const direct = path.join(STAGING, relativeSource);
  return direct;
}

async function main(): Promise<void> {
  let converted = 0;
  for (const sound of CURATED_SOUNDS) {
    const sourcePath = resolveSource(sound.sourceFile);
    if (!(await Bun.file(sourcePath).exists())) {
      throw new Error(`Missing source file: ${sourcePath}`);
    }
    const destPath = path.join(ASSETS, sound.relativePath);
    await convertSource(sourcePath, destPath, loudnessTarget(sound));
    converted += 1;
    console.log(`Curated ${sound.id} -> ${sound.relativePath}`);
  }
  console.log(`Curated ${converted} sounds into ${ASSETS}`);
}

await main();
