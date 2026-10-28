// @io-wall-ok — each checker owns private scratch until its evidence is published.
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { evidenceKey } from '@pkgs/conformance-shared-ts/evidence';
import { removeTree } from '@pkgs/os-server-ts/remove-tree';
import { copyModelEvidence } from './verify-model-evidence';

/** What an earlier verification of one model left in the report. */
function removeModelEvidence(report: string, specUri: string): void {
  const out = specUri.replace(/\W+/g, '-');
  for (const checker of ['apalache', 'tlc'])
    removeTree(join(report, checker, out));
  const evidence = join(report, 'evidence');
  let names: readonly string[];
  try {
    names = readdirSync(evidence);
  } catch {
    return;
  }
  const prefix = `${evidenceKey(specUri)}.`;
  for (const name of names)
    if (name.startsWith(prefix)) rmSync(join(evidence, name), { force: true });
}

/**
 * Reports can be replaced or restored while another verification's JVM is running.
 * Each run names the models it owns and replaces only their evidence. Other
 * checkers may be compiling sources inside the same package's report.
 */
export async function withModelWorkspace<T>(
  packageDir: string,
  verify: (workspace: string) => Promise<T>,
  only: readonly string[],
  /** A phase task adds its evidence and leaves the model's other phases. */
  mergeEvidence = false
): Promise<T> {
  const cache = join(packageDir, '.cache');
  mkdirSync(cache, { recursive: true });
  const workspace = mkdtempSync(join(cache, 'model-verify-'));
  const report = join(cache, 'harness-report/models');
  try {
    return await verify(workspace);
  } finally {
    try {
      if (!mergeEvidence)
        for (const specUri of only) removeModelEvidence(report, specUri);
      copyModelEvidence(workspace, report);
    } finally {
      removeTree(workspace, { whenLocked: 'leave' });
    }
  }
}
