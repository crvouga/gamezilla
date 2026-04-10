import { captureVersion, spawnInstall, verifyRun, whichSync } from './spawn';
import type { Dep, DepStatus } from './types';

const UA = 'gamezilla-infra-cli';
const FETCH_TIMEOUT_MS = 15_000;

export class WranglerDep implements Dep {
  readonly name = 'wrangler';
  readonly bin = 'wrangler';

  version(): string | null {
    return captureVersion('wrangler', ['--version']);
  }

  check(): DepStatus {
    if (!whichSync('wrangler'))
      return { ok: false, reason: 'not found on PATH' };
    const v = this.version();
    if (!v) return { ok: false, reason: 'could not determine version' };
    return { ok: true, version: v };
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
    spawnInstall('bun', ['add', '-g', 'wrangler@latest']);
  }

  upgrade(): void {
    spawnInstall('bun', ['add', '-g', 'wrangler@latest']);
  }

  verify(): void {
    verifyRun('wrangler', ['whoami']);
  }
}
