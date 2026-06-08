import {
  captureVersion,
  currentOs,
  FirstAvailableInstaller,
  GithubReleaseTarballInstaller,
  PackageManagerInstaller,
  verifyRun,
  which,
} from '@pkgs/os';
import { INFRA_CLI_USER_AGENT as UA } from '../constants';
import type { Dep, DepStatus } from './types';

/**
 * `pgweb` is the local Postgres web GUI launched by `pkgs/postgres/src/dev.ts`.
 * It's a single Go binary; we treat it like our other CLI tools (postgres /
 * stripe / wrangler / vault / bun): registered in `ALL_DEPS` so `setup`
 * enforces its presence, `status` reports it, and `deploy` refuses to run
 * when it is missing. The `dev` script itself treats a missing binary as a
 * soft warning (the cluster keeps running), but for a configured workstation
 * we want it present so developers don't silently lose the GUI.
 */
const FETCH_TIMEOUT_MS = 15_000;

const installer = new FirstAvailableInstaller(
  [
    new PackageManagerInstaller({
      entries: [
        { packageManagerId: 'homebrew', package: 'pgweb' },
        { packageManagerId: 'scoop', package: 'pgweb' },
      ],
    }),
    new GithubReleaseTarballInstaller({
      repo: 'sosedoff/pgweb',
      binName: 'pgweb',
      archive: (_version, os) => {
        const arch = os.releaseArchName() === 'arm64' ? 'arm64' : 'amd64';
        return {
          name: `pgweb_${os.releaseOsName()}_${arch}.zip`,
          format: 'zip',
        };
      },
    }),
  ],
  'Install pgweb manually: https://github.com/sosedoff/pgweb/releases'
);

export class PgwebDep implements Dep {
  readonly name = 'pgweb';
  readonly bin = 'pgweb';

  version(): string | null {
    if (!which('pgweb')) return null;
    return captureVersion('pgweb', ['--version']);
  }

  check(): DepStatus {
    if (!which('pgweb')) {
      return {
        ok: false,
        reason: `not found on PATH — ${installHint()}`,
      };
    }
    const v = this.version();
    if (v === null) return { ok: false, reason: 'could not determine version' };
    return { ok: true, version: v };
  }

  async fetchLatestVersion(): Promise<string | null> {
    try {
      const res = await fetch(
        'https://api.github.com/repos/sosedoff/pgweb/releases/latest',
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
      const m = /^v?([\d]+\.[\d]+[\w.+-]*)$/.exec(tag);
      return m?.[1]?.trim() ?? null;
    } catch {
      return null;
    }
  }

  install(): void {
    installer.install();
  }

  upgrade(): void {
    installer.upgrade();
  }

  verify(): void {
    verifyRun('pgweb', ['--version']);
  }
}

function installHint(): string {
  const os = currentOs();
  const pm = os.preferredPackageManager();
  if (pm !== null) {
    return `try \`${pm.id} install pgweb\` or download from https://github.com/sosedoff/pgweb/releases`;
  }
  return 'install via your platform package manager or download from https://github.com/sosedoff/pgweb/releases';
}
