import {
  captureVersionDiagnostic,
  NpmGlobalInstaller,
  verifyRun,
  which,
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

/**
 * EAS CLI (`eas-cli`, binary `eas`) — drives native EAS Build + OTA
 * `eas update` for the mobile client. Replaces the `expo/expo-github-action`
 * GitHub Action: the infra deploy invokes `eas` directly, the same way it
 * invokes `wrangler` / `stripe`.
 */
export class EasDep implements Dep {
  readonly name = 'eas';
  readonly bin = 'eas';

  private readonly installer = new NpmGlobalInstaller({
    pkg: 'eas-cli',
    tag: 'latest',
  });

  version(): string | null {
    return captureVersionDiagnostic('eas', ['--version']).version;
  }

  check(): DepStatus {
    if (!which('eas')) return { ok: false, reason: 'not found on PATH' };
    const d = captureVersionDiagnostic('eas', ['--version']);
    if (d.version !== null) return { ok: true, version: d.version };
    return {
      ok: false,
      reason:
        `could not determine version (\`eas --version\` exited ${String(d.status)}; ` +
        `stdout: ${summarize(d.stdout)}; stderr: ${summarize(d.stderr)}).`,
    };
  }

  async fetchLatestVersion(): Promise<string | null> {
    try {
      const res = await fetch('https://registry.npmjs.org/eas-cli/latest', {
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
    verifyRun('eas', ['whoami']);
  }
}
