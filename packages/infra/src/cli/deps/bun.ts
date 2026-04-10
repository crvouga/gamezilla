import { captureVersion, spawnInstall, verifyRun, whichSync } from './spawn';
import type { Dep, DepStatus } from './types';

const UA = 'gamezilla-infra-cli';
const FETCH_TIMEOUT_MS = 15_000;

export class BunDep implements Dep {
  readonly name = 'bun';
  readonly bin = 'bun';

  version(): string | null {
    return captureVersion('bun', ['--version']);
  }

  check(): DepStatus {
    if (!whichSync('bun')) return { ok: false, reason: 'not found on PATH' };
    const v = this.version();
    if (!v) return { ok: false, reason: 'could not determine version' };
    return { ok: true, version: v };
  }

  fetchLatestVersion(): Promise<string | null> {
    return fetchLatestBunVersion();
  }

  install(): void {
    spawnInstall('bash', ['-c', 'curl -fsSL https://bun.sh/install | bash']);
  }

  upgrade(): void {
    spawnInstall('bun', ['upgrade']);
  }

  verify(): void {
    verifyRun('bun', ['--version']);
  }
}

async function fetchLatestBunVersion(): Promise<string | null> {
  try {
    const res = await fetch(
      'https://api.github.com/repos/oven-sh/bun/releases/latest',
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': UA,
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { tag_name?: string };
    const tag = j.tag_name?.trim() ?? '';
    const m = /^bun-v(.+)$/i.exec(tag) ?? /^v?([\d.]+)/.exec(tag);
    return m?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}
