import { captureVersion, spawnInstall, verifyRun, whichSync } from './spawn';
import type { Dep, DepStatus } from './types';

/**
 * `pgweb` is the local Postgres web GUI launched by `apps/pg/src/dev.ts`. It's
 * a single Go binary; we treat it like our other CLI tools (postgres / stripe
 * / wrangler / doppler / bun): registered in `ALL_DEPS` so `setup` enforces
 * its presence, `status` reports it, and `deploy` refuses to run when it is
 * missing. The `dev` script itself treats a missing binary as a soft warning
 * (the cluster keeps running), but for a configured workstation we want it
 * present so developers don't silently lose the GUI.
 */

const HOMEBREW_FORMULA = 'pgweb';

function isMacOS(): boolean {
  return process.platform === 'darwin';
}

function isLinux(): boolean {
  return process.platform === 'linux';
}

function hasHomebrew(): boolean {
  return whichSync('brew');
}

function platformInstallHint(): string {
  if (isMacOS()) {
    return `Run \`brew install ${HOMEBREW_FORMULA}\`.`;
  }
  if (isLinux()) {
    return 'Download the pgweb release for your distro from https://github.com/sosedoff/pgweb/releases and place it on PATH.';
  }
  return 'Native Windows is not supported by `apps/pg`. Install pgweb inside WSL2 (https://github.com/sosedoff/pgweb).';
}

const UA = 'gamezilla-infra-cli';
const FETCH_TIMEOUT_MS = 15_000;

export class PgwebDep implements Dep {
  readonly name = 'pgweb';
  readonly bin = 'pgweb';

  version(): string | null {
    if (!whichSync('pgweb')) return null;
    return captureVersion('pgweb', ['--version']);
  }

  check(): DepStatus {
    if (!whichSync('pgweb')) {
      return {
        ok: false,
        reason: `not found on PATH — ${platformInstallHint()}`,
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
    if (isMacOS() && hasHomebrew()) {
      spawnInstall('brew', ['install', HOMEBREW_FORMULA]);
      return;
    }
    throw new Error(
      `Automatic pgweb install requires Homebrew on macOS. ${platformInstallHint()}`
    );
  }

  upgrade(): void {
    if (isMacOS() && hasHomebrew()) {
      spawnInstall('brew', ['upgrade', HOMEBREW_FORMULA]);
      return;
    }
    this.install();
  }

  verify(): void {
    verifyRun('pgweb', ['--version']);
  }
}
