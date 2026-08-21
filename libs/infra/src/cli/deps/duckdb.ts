import {
  CurlScriptInstaller,
  capture,
  captureVersionDiagnostic,
  FirstAvailableInstaller,
  Homebrew,
  PackageManagerInstaller,
  verifyRun,
  wallOsFs,
  which,
} from '@pkgs/os';

import { summarize } from './summarize';
import type { Dep, DepStatus } from './types';

const HOMEBREW_FORMULA = 'duckdb';
const WINGET_PACKAGE = 'DuckDB.cli';
const INSTALL_SCRIPT_URL = 'https://install.duckdb.org';

const INSTALL_HINT =
  'Install DuckDB CLI (`brew install duckdb` or `curl https://install.duckdb.org | sh`)';

const osFs = wallOsFs();

/** Parse `v1.5.4 1f98600c2c` / `1.5.4` → `1.5.4`. */
export function parseDuckdbVersion(text: string): string | null {
  const m = /v?(\d+\.\d+(?:\.\d+)?(?:[\w.+-]*)?)/i.exec(text.trim());
  return m?.[1]?.trim() ?? null;
}

const installer = new FirstAvailableInstaller(
  [
    new PackageManagerInstaller({
      entries: [
        { packageManagerId: 'homebrew', package: HOMEBREW_FORMULA },
        { packageManagerId: 'winget', package: WINGET_PACKAGE },
      ],
    }),
    new CurlScriptInstaller({
      url: INSTALL_SCRIPT_URL,
      shell: 'sh',
    }),
  ],
  INSTALL_HINT
);

export class DuckdbDep implements Dep {
  readonly name = 'duckdb';
  readonly bin = 'duckdb';

  version(): string | null {
    const d = captureVersionDiagnostic('duckdb', ['--version']);
    if (d.version !== null) return d.version;
    return parseDuckdbVersion(d.stdout) ?? parseDuckdbVersion(d.stderr);
  }

  check(): DepStatus {
    if (!which('duckdb')) {
      return { ok: false, reason: `not found on PATH — ${INSTALL_HINT}` };
    }
    const d = captureVersionDiagnostic('duckdb', ['--version']);
    const version =
      d.version ?? parseDuckdbVersion(d.stdout) ?? parseDuckdbVersion(d.stderr);
    if (version !== null) return { ok: true, version };
    return {
      ok: false,
      reason:
        `could not determine version (\`duckdb --version\` exited ${String(d.status)}; ` +
        `stdout: ${summarize(d.stdout)}; stderr: ${summarize(d.stderr)}).`,
    };
  }

  async fetchLatestVersion(): Promise<string | null> {
    const brew = new Homebrew(osFs.pathExists);
    if (!brew.isAvailable()) return null;
    const r = capture('brew', ['info', '--json=v2', HOMEBREW_FORMULA]);
    if (r.status !== 0) return null;
    try {
      const parsed = JSON.parse(r.stdout) as {
        formulae?: ReadonlyArray<{ versions?: { stable?: string } }>;
      };
      const stable = parsed.formulae?.[0]?.versions?.stable?.trim();
      return stable && stable.length > 0 ? stable : null;
    } catch {
      return null;
    }
  }

  install(): void {
    installer.install();
    const st = this.check();
    if (!st.ok) {
      throw new Error(`duckdb still unavailable after install — ${st.reason}`);
    }
  }

  upgrade(): void {
    installer.upgrade();
    const st = this.check();
    if (!st.ok) {
      throw new Error(`duckdb broken after upgrade — ${st.reason}`);
    }
  }

  verify(): void {
    verifyRun('duckdb', ['--version']);
  }
}
