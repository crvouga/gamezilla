import {
  captureVersionDiagnostic,
  NpmGlobalInstaller,
  verifyRun,
  which,
} from '@pkgs/os';
import type { Dep, DepStatus } from './types';

const UA = 'gamezilla-infra-cli';
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

export class WranglerDep implements Dep {
  readonly name = 'wrangler';
  readonly bin = 'wrangler';

  private readonly installer = new NpmGlobalInstaller({
    pkg: 'wrangler',
    tag: 'latest',
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
    try {
      const res = await fetch('https://registry.npmjs.org/wrangler/latest', {
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
    verifyRun('wrangler', ['whoami']);
  }
}
