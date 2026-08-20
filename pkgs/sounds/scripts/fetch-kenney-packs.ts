// @io-wall-ok
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.join(import.meta.dir, '..');
const CACHE = path.join(ROOT, '.cache', 'kenney');
const STAGING = path.join(CACHE, 'staging');

const PACKS: ReadonlyArray<{ name: string; url: string }> = [
  {
    name: 'kenney_interfaceSounds.zip',
    url: 'https://opengameart.org/sites/default/files/kenney_interfaceSounds.zip',
  },
  {
    name: 'kenney-ui-audio.zip',
    url: 'https://github.com/Calinou/kenney-ui-audio/archive/refs/heads/master.zip',
  },
  {
    name: 'jingleSounds_Kenney.zip',
    url: 'https://opengameart.org/sites/default/files/jingleSounds_Kenney.zip',
  },
  {
    name: 'Digital_SFX_Set.zip',
    url: 'https://opengameart.org/sites/default/files/Digital_SFX_Set.zip',
  },
  {
    name: 'kenney_casino-audio.zip',
    url: 'https://opengameart.org/sites/default/files/kenney_casino-audio.zip',
  },
  {
    name: 'RPGsounds_Kenney.zip',
    url: 'https://opengameart.org/sites/default/files/RPGsounds_Kenney.zip',
  },
  {
    name: 'pingthings-kenney-packs.zip',
    url: 'https://github.com/JustPinero/pingthings/archive/refs/heads/main.zip',
  },
];

async function download(name: string, url: string): Promise<void> {
  const dest = path.join(CACHE, name);
  const res = await globalThis.fetch(url);
  if (!res.ok) {
    throw new Error(
      `Failed to download ${name}: ${res.status} ${res.statusText}`
    );
  }
  const buf = await res.arrayBuffer();
  await Bun.write(dest, buf);
  console.log(`Downloaded ${name} (${buf.byteLength} bytes)`);
}

async function extractZip(zipPath: string, destDir: string): Promise<void> {
  const proc = Bun.spawn(['unzip', '-q', '-o', zipPath, '-d', destDir], {
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`unzip failed for ${zipPath}`);
  }
}

async function main(): Promise<void> {
  await mkdir(CACHE, { recursive: true });
  await rm(STAGING, { recursive: true, force: true });
  await mkdir(STAGING, { recursive: true });

  for (const pack of PACKS) {
    const dest = path.join(CACHE, pack.name);
    try {
      await download(pack.name, pack.url);
    } catch (error) {
      if (await Bun.file(dest).exists()) {
        console.warn(`Using cached ${pack.name}`);
      } else {
        throw error;
      }
    }
    const extractName = pack.name.replace(/\.zip$/, '');
    await extractZip(dest, path.join(STAGING, extractName));
  }

  console.log('Kenney packs fetched and extracted.');
}

await main();
