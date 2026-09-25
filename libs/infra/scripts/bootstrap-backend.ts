// @io-wall-ok — CLI helper: the bootstrap stack's one-time local → S3 state move.
/**
 * The bootstrap stack creates the bucket every stack (itself included)
 * keeps state in, so its first apply cannot use that bucket. Detected by the
 * state credential being absent from the secrets store: that run uses a
 * local backend (an `*_override.tf` file, gitignored), then — once the
 * bucket, its credential and the store entries exist — migrates the state
 * into the bucket and deletes the local copy. Every later run is plain S3.
 */
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  localBackendOverride,
  migrateStateArgs,
  outputArgs,
  stackDir,
  type Target,
  type TofuPaths,
} from '@libs/infra/public/tofu-command';
import { fail, spawnTool, tofu } from './tofu-process';

const OVERRIDE = 'zz_local_backend_override.tf';
const MIGRATE_ATTEMPTS = 6;
const MIGRATE_BACKOFF_MS = 10_000;

export function localStatePath(paths: TofuPaths): string {
  return join(paths.cacheDir, 'bootstrap-first-run.tfstate');
}

export function useLocalBackend(paths: TofuPaths): void {
  writeFileSync(
    join(stackDir(paths, 'bootstrap'), OVERRIDE),
    localBackendOverride(localStatePath(paths))
  );
}

export function dropLocalBackend(paths: TofuPaths): void {
  rmSync(join(stackDir(paths, 'bootstrap'), OVERRIDE), { force: true });
}

type Outputs = Record<string, { readonly value: unknown }>;

/** After the first apply: move state into the bucket it just created. */
export async function migrateToBucket(
  paths: TofuPaths,
  target: Target,
  env: Record<string, string>
): Promise<void> {
  const shown = spawnTool('tofu', outputArgs(paths, target), {
    env,
    capture: true,
  });
  if (shown.status !== 0)
    fail(`bootstrap: tofu output failed: ${shown.stderr}`);
  const outputs = JSON.parse(shown.stdout) as Outputs;
  const credentials = {
    ...env,
    AWS_ACCESS_KEY_ID: String(outputs['state_access_key_id']?.value ?? ''),
    AWS_SECRET_ACCESS_KEY: String(
      outputs['state_secret_access_key']?.value ?? ''
    ),
  };
  dropLocalBackend(paths);
  // A new R2 credential can take a few seconds to become valid.
  for (let attempt = 1; attempt <= MIGRATE_ATTEMPTS; attempt += 1) {
    if (tofu(migrateStateArgs(paths, target), credentials) === 0) {
      rmSync(localStatePath(paths), { force: true });
      rmSync(`${localStatePath(paths)}.backup`, { force: true });
      console.log('[infra] bootstrap: state migrated into the state bucket');
      return;
    }
    await Bun.sleep(MIGRATE_BACKOFF_MS * attempt);
  }
  fail(
    `bootstrap: could not migrate state into the bucket; the applied state is kept at ${localStatePath(paths)} — rerun \`tofu.ts apply --stack bootstrap\` once TOFU_STATE_* are in the secrets store`
  );
}
