/**
 * One-off migration: convert curated assets from WAV to MP3 and update references.
 * Run: bun run pkgs/sounds/scripts/convert-wav-to-mp3.ts
 * Safe to delete after assets are migrated.
 */
import { readdir, unlink } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.join(import.meta.dir, '..');
const ASSETS = path.join(ROOT, 'assets');
const CURATE_MAPPING = path.join(import.meta.dir, 'curate-mapping.ts');
const CHESS_SOURCES = path.join(ROOT, 'src', 'chess-sound-sources.ts');
const ASSETS_DTS = path.join(ROOT, 'src', 'assets.d.ts');
const CURATE_SOUNDS = path.join(import.meta.dir, 'curate-sounds.ts');

async function walkWavFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkWavFiles(fullPath)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.wav')) {
      files.push(fullPath);
    }
  }
  return files;
}

async function convertWavToMp3(wavPath: string): Promise<void> {
  const mp3Path = wavPath.replace(/\.wav$/i, '.mp3');
  const proc = Bun.spawn(
    [
      'ffmpeg',
      '-y',
      '-loglevel',
      'error',
      '-i',
      wavPath,
      '-codec:a',
      'libmp3lame',
      '-qscale:a',
      '2',
      '-ar',
      '44100',
      '-ac',
      '1',
      mp3Path,
    ],
    { stdout: 'pipe', stderr: 'pipe' }
  );
  const code = await proc.exited;
  if (code !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(`ffmpeg failed for ${wavPath}: ${err}`);
  }
  await unlink(wavPath);
}

async function updateTextFiles(): Promise<void> {
  const mapping = await Bun.file(CURATE_MAPPING).text();
  const updatedMapping = mapping.replace(
    /relativePath: '([^']+)\.wav'/g,
    "relativePath: '$1.mp3'"
  );
  if (updatedMapping === mapping) {
    throw new Error('No relativePath .wav entries updated in curate-mapping.ts');
  }
  await Bun.write(CURATE_MAPPING, updatedMapping);

  const chess = await Bun.file(CHESS_SOURCES).text();
  const updatedChess = chess.replace(/\.wav'/g, ".mp3'");
  await Bun.write(CHESS_SOURCES, updatedChess);

  await Bun.write(
    ASSETS_DTS,
    `declare module '*.mp3' {
  const asset: number;
  export default asset;
}
`
  );

  const curateSounds = await Bun.file(CURATE_SOUNDS).text();
  const updatedCurateSounds = curateSounds.replace(
    /'-sample_fmt',\s*\n\s*'s16',\s*\n\s*destPath,/,
    "'-codec:a',\n      'libmp3lame',\n      '-qscale:a',\n      '2',\n      destPath,"
  );
  await Bun.write(CURATE_SOUNDS, updatedCurateSounds);
}

async function main(): Promise<void> {
  const wavFiles = await walkWavFiles(ASSETS);
  if (wavFiles.length === 0) {
    console.log('No .wav files found under assets/ — already migrated?');
    return;
  }

  console.log(`Converting ${wavFiles.length} WAV files to MP3…`);
  for (const wavPath of wavFiles.sort()) {
    await convertWavToMp3(wavPath);
    console.log(`  ${path.relative(ASSETS, wavPath)} -> .mp3`);
  }

  await updateTextFiles();
  console.log('Updated curate-mapping.ts, chess-sound-sources.ts, assets.d.ts, curate-sounds.ts');

  const proc = Bun.spawn(['bun', 'run', path.join(import.meta.dir, 'generate-manifest.ts')], {
    cwd: ROOT,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error('generate-manifest.ts failed');
  }

  console.log('Done — delete this script when no longer needed.');
}

await main();
