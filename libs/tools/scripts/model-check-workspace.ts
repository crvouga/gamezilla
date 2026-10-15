// @io-wall-ok — each checker owns private scratch until its evidence is published.
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { evidenceKey } from '@pkgs/conformance-shared/evidence';
import { copyModelEvidence } from './check-model-evidence';

/** What an earlier check of one model left in the report. */
function removeModelEvidence(report: string, specUri: string): void {
  const out = specUri.replace(/\W+/g, '-');
  for (const checker of ['apalache', 'tlc'])
    rmSync(join(report, checker, out), { recursive: true, force: true });
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
 * Reports can be replaced or restored while another check's JVM is running.
 * Each run names the models it owns and replaces only their evidence. Other
 * checkers may be compiling sources inside the same package's report.
 */
export async function withModelWorkspace<T>(
  packageDir: string,
  check: (workspace: string) => Promise<T>,
  only: readonly string[],
  /** A phase task adds its evidence and leaves the model's other phases. */
  mergeEvidence = false
): Promise<T> {
  const cache = join(packageDir, '.cache');
  mkdirSync(cache, { recursive: true });
  const workspace = mkdtempSync(join(cache, 'model-check-'));
  const report = join(cache, 'harness-report/models');
  try {
    return await check(workspace);
  } finally {
    try {
      if (!mergeEvidence)
        for (const specUri of only) removeModelEvidence(report, specUri);
      copyModelEvidence(workspace, report);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  }
}
