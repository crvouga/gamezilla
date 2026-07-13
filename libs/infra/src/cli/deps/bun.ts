import {
  captureVersion,
  CurlScriptInstaller,
  run,
  verifyRun,
  which,
} from '@pkgs/os';
import type { Dep, DepStatus } from './types';
import { fetchLatestGithubReleaseVersion } from './version-fetch';

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
    return fetchLatestGithubReleaseVersion('oven-sh/bun', (tag) => {
      const m = /^bun-v(.+)$/i.exec(tag) ?? /^v?([\d.]+)/.exec(tag);
      return m?.[1]?.trim() ?? null;
    });
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
