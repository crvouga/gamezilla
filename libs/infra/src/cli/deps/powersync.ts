import { captureVersion, which } from '@pkgs/os';
import { INFRA_CLI_USER_AGENT as UA } from '../constants';
import type { Dep, DepStatus } from './types';

const FETCH_TIMEOUT_MS = 15_000;
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
    try {
      const res = await fetch('https://registry.npmjs.org/powersync/latest', {
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
