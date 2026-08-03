import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  capture,
  captureVersion,
  FirstAvailableInstaller,
  Homebrew,
  PackageManagerInstaller,
  whichPath,
} from '@pkgs/os';

import type { Dep, DepStatus } from './types';

/**
 * Client tools major that matches hosted Postgres (Neon currently serves 18.x).
 * `pg_dump` must be >= server major or it aborts with a version mismatch.
 */
export const PG_DUMP_REQUIRED_MAJOR = 18;

const HOMEBREW_FORMULA = `postgresql@${PG_DUMP_REQUIRED_MAJOR}`;

const INSTALL_HINT =
  `Install PostgreSQL ${PG_DUMP_REQUIRED_MAJOR} client tools ` +
  `(Homebrew: \`brew install ${HOMEBREW_FORMULA}\`) so pg_dump matches the ` +
  'hosted server major version';

/**
 * Prefer the Homebrew keg-only bin for {@link HOMEBREW_FORMULA}, then PATH.
 * Keg-only installs are not symlinked into `/opt/homebrew/bin`, so a older
 * `postgresql@N` on PATH would otherwise shadow the required major.
 */
export function resolvePgDumpPath(): string | null {
  const brew = new Homebrew();
  if (brew.isAvailable()) {
    const dir = brew.binDirFor(HOMEBREW_FORMULA);
    if (dir !== null) {
      const candidate = join(dir, 'pg_dump');
      if (existsSync(candidate)) return candidate;
    }
  }
  return whichPath('pg_dump');
}

/** Parse `pg_dump (PostgreSQL) 18.4` → `18.4`. */
export function parsePgDumpVersion(text: string): string | null {
  const m = /(?:PostgreSQL\)\s+|pg_dump\s+)(\d+\.\d+(?:\.\d+)?)/i.exec(text);
  return m?.[1]?.trim() ?? null;
}

function readPgDumpVersion(bin: string): string | null {
  const r = capture(bin, ['--version']);
  if (r.status !== 0) return null;
  return parsePgDumpVersion(r.stdout) ?? captureVersion(bin, ['--version']);
}

function majorOf(version: string): number | null {
  const n = parseInt(version.split('.')[0] ?? '', 10);
  return Number.isFinite(n) ? n : null;
}

const installer = new FirstAvailableInstaller(
  [
    new PackageManagerInstaller({
      entries: [
        { packageManagerId: 'homebrew', package: HOMEBREW_FORMULA },
        {
          packageManagerId: 'apt',
          package: `postgresql-client-${PG_DUMP_REQUIRED_MAJOR}`,
        },
      ],
    }),
  ],
  INSTALL_HINT
);

export class PgDumpDep implements Dep {
  readonly name = 'pg_dump';
  readonly bin = 'pg_dump';

  version(): string | null {
    const bin = resolvePgDumpPath();
    if (bin === null) return null;
    return readPgDumpVersion(bin);
  }

  check(): DepStatus {
    const bin = resolvePgDumpPath();
    if (bin === null) {
      return { ok: false, reason: `not found — ${INSTALL_HINT}` };
    }
    const v = readPgDumpVersion(bin);
    if (!v) return { ok: false, reason: 'could not determine version' };
    const major = majorOf(v);
    if (major === null || major < PG_DUMP_REQUIRED_MAJOR) {
      return {
        ok: false,
        reason: `have ${v} (need major >= ${PG_DUMP_REQUIRED_MAJOR}) — ${INSTALL_HINT}`,
      };
    }
    return { ok: true, version: v };
  }

  async fetchLatestVersion(): Promise<string | null> {
    const brew = new Homebrew();
    if (!brew.isAvailable()) {
      // Non-Homebrew: treat required major as the floor; skip upgrade churn.
      return `${PG_DUMP_REQUIRED_MAJOR}.0.0`;
    }
    const r = capture('brew', ['info', '--json=v2', HOMEBREW_FORMULA]);
    if (r.status !== 0) return null;
    try {
      const parsed = JSON.parse(r.stdout) as {
        formulae?: ReadonlyArray<{ versions?: { stable?: string } }>;
      };
      const stable = parsed.formulae?.[0]?.versions?.stable?.trim();
      return stable && stable.length > 0 ? stable : null;
    } catch {
      return null;
    }
  }

  install(): void {
    installer.install();
    const st = this.check();
    if (!st.ok) {
      throw new Error(`pg_dump still unavailable after install — ${st.reason}`);
    }
  }

  upgrade(): void {
    installer.upgrade();
    const st = this.check();
    if (!st.ok) {
      throw new Error(`pg_dump broken after upgrade — ${st.reason}`);
    }
  }

  verify(): void {
    const bin = resolvePgDumpPath();
    if (bin === null || !existsSync(bin)) {
      throw new Error(`pg_dump verify failed — ${INSTALL_HINT}`);
    }
    const v = readPgDumpVersion(bin);
    if (!v) {
      throw new Error('pg_dump verify failed — could not read --version');
    }
    const major = majorOf(v);
    if (major === null || major < PG_DUMP_REQUIRED_MAJOR) {
      throw new Error(
        `pg_dump verify failed — have ${v}, need major >= ${PG_DUMP_REQUIRED_MAJOR}`
      );
    }
  }
}
