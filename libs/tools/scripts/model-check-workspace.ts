// @io-wall-ok — each checker owns private scratch until its evidence is published.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { copyModelEvidence } from './check-model-evidence';

/** Reports can be replaced or restored while another check's JVM is running. */
export async function withModelWorkspace<T>(
  packageDir: string,
  check: (workspace: string) => Promise<T>
): Promise<T> {
  const cache = join(packageDir, '.cache');
  mkdirSync(cache, { recursive: true });
  const workspace = mkdtempSync(join(cache, 'model-check-'));
  const report = join(cache, 'harness-report/models');
  try {
    return await check(workspace);
  } finally {
    try {
      rmSync(report, { recursive: true, force: true });
      copyModelEvidence(workspace, report);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  }
}
