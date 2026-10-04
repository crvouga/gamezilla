// @io-wall-ok — exchange complete immutable artifacts, never task working files.
import {
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';

function artifacts(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).filter(
    (file) =>
      /^[a-f0-9]+\.tar\.zst$/.test(file) &&
      existsSync(join(directory, file.replace('.tar.zst', '-meta.json')))
  );
}

/** Each run gets independent copies of previously completed cache entries. */
export function restoreCheckArtifacts(store: string, cache: string): void {
  mkdirSync(cache, { recursive: true });
  for (const archive of artifacts(store)) {
    for (const name of [archive, archive.replace('.tar.zst', '-meta.json')])
      copyFileSync(
        join(store, name),
        join(cache, name),
        constants.COPYFILE_FICLONE
      );
  }
}

/** Publish after Turbo exits successfully; readers only see fully copied pairs. */
export function publishCheckArtifacts(cache: string, store: string): void {
  mkdirSync(store, { recursive: true });
  const temporary = mkdtempSync(join(store, '.pending-'));
  try {
    for (const archive of artifacts(cache)) {
      const metadata = archive.replace('.tar.zst', '-meta.json');
      if (existsSync(join(store, archive)) && existsSync(join(store, metadata)))
        continue;
      for (const name of [archive, metadata])
        copyFileSync(
          join(cache, name),
          join(temporary, name),
          constants.COPYFILE_FICLONE
        );
      renameSync(join(temporary, archive), join(store, archive));
      renameSync(join(temporary, metadata), join(store, metadata));
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
