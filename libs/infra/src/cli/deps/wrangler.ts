import {
  captureVersionDiagnostic,
  NpmGlobalInstaller,
  verifyRun,
  wallOsFs,
  which,
} from '@pkgs/os';
import { summarize } from './summarize';
import type { Dep, DepStatus } from './types';
import { fetchLatestNpmVersion } from './version-fetch';

export class WranglerDep implements Dep {
  readonly name = 'wrangler';
  readonly bin = 'wrangler';

  private readonly installer = new NpmGlobalInstaller({
    pkg: 'wrangler',
    bin: 'wrangler',
    tag: 'latest',
    pathExists: wallOsFs().pathExists,
  });

  version(): string | null {
    return captureVersionDiagnostic('wrangler', ['--version']).version;
  }

  check(): DepStatus {
    if (!which('wrangler')) return { ok: false, reason: 'not found on PATH' };
    const d = captureVersionDiagnostic('wrangler', ['--version']);
    if (d.version !== null) return { ok: true, version: d.version };
    return {
      ok: false,
      reason:
        `could not determine version (\`wrangler --version\` exited ${String(d.status)}; ` +
        `stdout: ${summarize(d.stdout)}; stderr: ${summarize(d.stderr)}). ` +
        `If running in CI, ensure wrangler installed cleanly (try \`npm install -g wrangler@latest\` instead of \`bun add -g\`).`,
    };
  }

  async fetchLatestVersion(): Promise<string | null> {
    return fetchLatestNpmVersion('wrangler');
  }

  install(): void {
    this.installer.install();
  }

  upgrade(): void {
    this.installer.upgrade();
  }

  verify(): void {
    verifyRun('wrangler', ['whoami']);
  }
}
