import {
  captureVersionDiagnostic,
  NpmGlobalInstaller,
  verifyRun,
} from '@pkgs/os';
import { INFRA_CLI_USER_AGENT as UA } from '../constants';
import type { Dep, DepStatus } from './types';

const FETCH_TIMEOUT_MS = 15_000;

function summarize(stream: string): string {
  const trimmed = stream.trim();
  if (trimmed.length === 0) return '<empty>';
  const lines = trimmed.split('\n');
  const head = lines.slice(0, 3).join(' / ');
  return lines.length > 3
    ? `${head} … (+${String(lines.length - 3)} more lines)`
    : head;
}

export class TurboDep implements Dep {
  readonly name = 'turbo';
  readonly bin = 'turbo';

  private readonly installer = new NpmGlobalInstaller({
    pkg: 'turbo',
    tag: 'latest',
  });

  version(): string | null {
    return this.installer.installedVersion();
  }

  check(): DepStatus {
    const bin = this.installer.globalBinPath();
    if (bin === null) {
      return {
        ok: false,
        reason:
          'global turbo not found (`npm install -g turbo`); workspace `node_modules/.bin/turbo` is ignored',
      };
    }

    const pkgVersion = this.installer.installedVersion();
    if (pkgVersion === null) {
      return { ok: false, reason: 'global turbo package version unknown' };
    }

    const d = captureVersionDiagnostic(bin, ['--version']);
    if (d.status !== 0) {
      return {
        ok: false,
        reason:
          `global turbo failed (\`${bin} --version\` exited ${String(d.status)}; ` +
          `stdout: ${summarize(d.stdout)}; stderr: ${summarize(d.stderr)})`,
      };
    }

    return { ok: true, version: pkgVersion };
  }

  async fetchLatestVersion(): Promise<string | null> {
    try {
      const res = await fetch('https://registry.npmjs.org/turbo/latest', {
        headers: { Accept: 'application/json', 'User-Agent': UA },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const j = (await res.json()) as { version?: string };
      return typeof j.version === 'string' ? j.version.trim() : null;
    } catch {
      return null;
    }
  }

  install(): void {
    this.installer.install();
  }

  upgrade(): void {
    this.installer.upgrade();
  }

  verify(): void {
    const bin = this.installer.globalBinPath();
    if (bin === null) {
      throw new Error('global turbo binary not found on PATH via npm prefix -g');
    }
    verifyRun(bin, ['--version']);
  }
}
