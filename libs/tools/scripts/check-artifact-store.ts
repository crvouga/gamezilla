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
import { findBudgetOverruns, type RunSummary } from './check-budget';

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

/** Publish only summary-confirmed passes; readers only see fully copied pairs. */
export function publishCheckArtifacts(
  cache: string,
  store: string,
  summary: RunSummary | null,
  env: NodeJS.ProcessEnv = process.env
): void {
  const overBudget = new Set(
    findBudgetOverruns(summary ?? {}, false, env).map((task) => task.taskId)
  );
  const passed = new Set(
    (summary?.tasks ?? [])
      .filter(
        (task) =>
          !(typeof task.taskId === 'string' && overBudget.has(task.taskId)) &&
          (task.execution?.exitCode === 0 ||
            (task.execution?.exitCode === undefined &&
              task.cache?.status === 'HIT'))
      )
      .map((task) => task.hash)
  );
  mkdirSync(store, { recursive: true });
  const temporary = mkdtempSync(join(store, '.pending-'));
  try {
    for (const archive of artifacts(cache)) {
      if (!passed.has(archive.replace('.tar.zst', ''))) continue;
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
