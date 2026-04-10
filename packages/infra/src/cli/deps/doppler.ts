import { captureVersion, spawnInstall, verifyRun, whichSync } from './spawn';
import type { Dep, DepStatus } from './types';

const UA = 'gamezilla-infra-cli';
const FETCH_TIMEOUT_MS = 15_000;

export class DopplerDep implements Dep {
  readonly name = 'doppler';
  readonly bin = 'doppler';

  version(): string | null {
    return captureVersion('doppler', ['--version']);
  }

  check(): DepStatus {
    if (!whichSync('doppler'))
      return { ok: false, reason: 'not found on PATH' };
    const v = this.version();
    if (!v) return { ok: false, reason: 'could not determine version' };
    return { ok: true, version: v };
  }

  async fetchLatestVersion(): Promise<string | null> {
    try {
      const res = await fetch(
        'https://api.github.com/repos/DopplerHQ/cli/releases/latest',
        {
          headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': UA,
          },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        }
      );
      if (!res.ok) return null;
      const j = (await res.json()) as { tag_name?: string };
      const tag = j.tag_name?.trim() ?? '';
      const m = /^v?([\d.]+(?:\.[\d]+)*)$/.exec(tag);
      return m?.[1]?.trim() ?? null;
    } catch {
      return null;
    }
  }

  install(): void {
    spawnInstall('brew', ['install', 'dopplerhq/cli/doppler']);
  }

  upgrade(): void {
    spawnInstall('brew', ['upgrade', 'dopplerhq/cli/doppler']);
  }

  verify(): void {
    verifyRun('doppler', ['--version']);
  }
}
