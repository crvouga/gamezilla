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

/**
 * EAS CLI (`eas-cli`, binary `eas`) — drives native EAS Build + OTA
 * `eas update` for the mobile client. Replaces the `expo/expo-github-action`
 * GitHub Action: the infra deploy invokes `eas` directly, the same way it
 * invokes `wrangler`.
 */
export class EasDep implements Dep {
  readonly name = 'eas';
  readonly bin = 'eas';

  private readonly installer = new NpmGlobalInstaller({
    pkg: 'eas-cli',
    bin: 'eas',
    tag: 'latest',
      pathExists: wallOsFs().pathExists,
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
    return fetchLatestNpmVersion('eas-cli');
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
