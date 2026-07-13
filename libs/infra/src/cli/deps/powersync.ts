import { captureVersion, which } from '@pkgs/os';
import type { Dep, DepStatus } from './types';
import { fetchLatestNpmVersion } from './version-fetch';

const INSTALL_HINT = 'Install PowerSync CLI: npm install -g powersync';

export class PowerSyncDep implements Dep {
  readonly name = 'powersync';
  readonly bin = 'powersync';

  version(): string | null {
    if (which('powersync')) {
      return captureVersion('powersync', ['--version']);
    }
    return captureVersion('bunx', ['powersync@latest', '--version']);
  }

  check(): DepStatus {
    if (which('powersync')) {
      const v = this.version();
      if (!v) return { ok: false, reason: 'could not determine version' };
      return { ok: true, version: v };
    }
    const v = captureVersion('bunx', ['powersync@latest', '--version']);
    if (!v) {
      return {
        ok: false,
        reason: `not found on PATH — ${INSTALL_HINT} or ensure bunx can fetch powersync@latest`,
      };
    }
    return { ok: true, version: `${v} (via bunx)` };
  }

  async fetchLatestVersion(): Promise<string | null> {
    return fetchLatestNpmVersion('powersync');
  }

  install(): void {
    throw new Error(
      `${INSTALL_HINT} — PowerSync CLI is not bundled in the workspace`
    );
  }

  upgrade(): void {
    throw new Error(
      `${INSTALL_HINT} — upgrade the global powersync CLI outside the repo`
    );
  }
}
