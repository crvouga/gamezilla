import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  captureVersion,
  currentOs,
  FirstAvailableInstaller,
  Homebrew,
  PackageManagerInstaller,
  verifyRun,
  which,
} from '@pkgs/os';
import type { Dep, DepStatus } from './types';

/**
 * Required CLI tooling for the local PostgreSQL cluster managed by
 * `@pkgs/postgres` (see `pkgs/postgres/src/dev.ts`).
 *
 * We need four binaries: `postgres` (server), `pg_ctl` (lifecycle),
 * `initdb` (cluster bootstrap), `pg_isready` (readiness probe). All ship
 * together in the standard PostgreSQL distribution.
 *
 * Version policy:
 *
 * - `version()` reports the `postgres` major.minor (e.g. `17.4`) extracted from
 *   `postgres --version`.
 * - `fetchLatestVersion()` returns `null` on purpose. PostgreSQL releases use
 *   tags like `REL_17_6` that are not directly comparable to the runtime
 *   `17.4` string our `semverCompare` understands; rather than ship a fragile
 *   parser that occasionally flags `deploy` as outdated for cosmetic reasons,
 *   we let `setup`/`status` warn "could not resolve latest" and rely on
 *   `check()` for hard enforcement that the binaries exist.
 *
 * Install policy: defers entirely to the cross-platform {@link PackageManagerInstaller}
 * registered below. Homebrew is the only one that needs special handling
 * (keg-only formulas install outside the default PATH); we look those bin
 * dirs up directly via {@link Homebrew.binDirFor} when probing for
 * binaries.
 */
const REQUIRED_BINARIES = [
  'postgres',
  'pg_ctl',
  'initdb',
  'pg_isready',
] as const;

const HOMEBREW_FORMULA = 'postgresql@17';
const HOMEBREW_FALLBACK_FORMULAS = [
  HOMEBREW_FORMULA,
  'postgresql@16',
  'postgresql@15',
  'postgresql',
] as const;

const installer = new FirstAvailableInstaller(
  [
    new PackageManagerInstaller({
      entries: [
        { packageManagerId: 'homebrew', package: HOMEBREW_FORMULA },
        { packageManagerId: 'apt', package: 'postgresql' },
        { packageManagerId: 'dnf', package: 'postgresql-server' },
        { packageManagerId: 'pacman', package: 'postgresql' },
        {
          packageManagerId: 'winget',
          package: 'PostgreSQL.PostgreSQL',
        },
        { packageManagerId: 'scoop', package: 'postgresql' },
        { packageManagerId: 'chocolatey', package: 'postgresql' },
      ],
    }),
  ],
  manualInstallHint()
);

/** Resolve `postgres` binary path: PATH first, then any Homebrew keg formula. */
function findCanonicalBin(): string | null {
  if (REQUIRED_BINARIES.every((b) => which(b))) return 'postgres';
  const dir = homebrewKegBinDir();
  if (dir !== null) return join(dir, 'postgres');
  return null;
}

function homebrewKegBinDir(): string | null {
  if (currentOs().platform !== 'darwin') return null;
  const brew = new Homebrew();
  if (!brew.isAvailable()) return null;
  for (const formula of HOMEBREW_FALLBACK_FORMULAS) {
    const dir = brew.binDirFor(formula);
    if (dir === null) continue;
    if (REQUIRED_BINARIES.every((b) => existsSync(join(dir, b)))) return dir;
  }
  return null;
}

function missingBinaries(): readonly string[] {
  if (REQUIRED_BINARIES.every((b) => which(b))) return [];
  const dir = homebrewKegBinDir();
  if (dir !== null) {
    return REQUIRED_BINARIES.filter((b) => !existsSync(join(dir, b)));
  }
  return REQUIRED_BINARIES.filter((b) => !which(b));
}

function manualInstallHint(): string {
  return (
    'Install PostgreSQL and ensure `postgres`, `pg_ctl`, `initdb`, `pg_isready` are on PATH ' +
    '(macOS: `brew install postgresql@17` + add `$(brew --prefix postgresql@17)/bin` to PATH ' +
    'or `PG_BIN_DIR`; Linux: install via your package manager; Windows: `winget install PostgreSQL.PostgreSQL`).'
  );
}

export class PostgresDep implements Dep {
  readonly name = 'postgres';
  readonly bin = 'postgres';

  version(): string | null {
    if (which('postgres')) return captureVersion('postgres', ['--version']);
    const dir = homebrewKegBinDir();
    if (dir !== null) return captureVersion(join(dir, 'postgres'), ['--version']);
    return null;
  }

  check(): DepStatus {
    const missing = missingBinaries();
    if (missing.length > 0) {
      return {
        ok: false,
        reason: `missing binaries: ${missing.join(', ')} — ${manualInstallHint()}`,
      };
    }
    const v = this.version();
    if (v === null) {
      return { ok: false, reason: 'could not determine version' };
    }
    return { ok: true, version: v };
  }

  fetchLatestVersion(): Promise<string | null> {
    return Promise.resolve(null);
  }

  install(): void {
    installer.install();
  }

  upgrade(): void {
    installer.upgrade();
  }

  verify(): void {
    const canonical = findCanonicalBin();
    if (canonical === null) {
      throw new Error('postgres CLI not available after install');
    }
    verifyRun(canonical, ['--version']);
  }
}
