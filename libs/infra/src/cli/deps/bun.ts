import {
  captureVersion,
  CurlScriptInstaller,
  run,
  verifyRun,
  which,
} from '@pkgs/os';
import { INFRA_CLI_USER_AGENT as UA } from '../constants';
import type { Dep, DepStatus } from './types';

const FETCH_TIMEOUT_MS = 15_000;

export class BunDep implements Dep {
  readonly name = 'bun';
  readonly bin = 'bun';

  private readonly installer = new CurlScriptInstaller({
    url: 'https://bun.sh/install',
  });

  version(): string | null {
    return captureVersion('bun', ['--version']);
  }

  check(): DepStatus {
    if (!which('bun')) return { ok: false, reason: 'not found on PATH' };
    const v = this.version();
    if (!v) return { ok: false, reason: 'could not determine version' };
    return { ok: true, version: v };
  }

  async fetchLatestVersion(): Promise<string | null> {
    try {
      const res = await fetch(
        'https://api.github.com/repos/oven-sh/bun/releases/latest',
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
      const m = /^bun-v(.+)$/i.exec(tag) ?? /^v?([\d.]+)/.exec(tag);
      return m?.[1]?.trim() ?? null;
    } catch {
      return null;
    }
  }

  install(): void {
    this.installer.install();
  }

  upgrade(): void {
    run('bun', ['upgrade']);
  }

  verify(): void {
    verifyRun('bun', ['--version']);
  }
}
