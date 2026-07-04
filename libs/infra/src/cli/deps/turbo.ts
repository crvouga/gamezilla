import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  capture,
  captureVersionDiagnostic,
  run,
  verifyRun,
} from '@pkgs/os';
import { INFRA_CLI_USER_AGENT as UA } from '../constants';
import { REPO_ROOT } from '../paths';
import type { Dep, DepStatus } from './types';

const FETCH_TIMEOUT_MS = 15_000;
const TURBO_PKG_JSON = join(REPO_ROOT, 'node_modules/turbo/package.json');
const TURBO_BIN = join(REPO_ROOT, 'node_modules/.bin/turbo');
const ROOT_PACKAGE_JSON = join(REPO_ROOT, 'package.json');
const CATALOG_TURBO_RE = /("turbo":\s*"\^)[^"]+(")/;

function summarize(stream: string): string {
  const trimmed = stream.trim();
  if (trimmed.length === 0) return '<empty>';
  const lines = trimmed.split('\n');
  const head = lines.slice(0, 3).join(' / ');
  return lines.length > 3
    ? `${head} … (+${String(lines.length - 3)} more lines)`
    : head;
}

function readWorkspaceTurboVersion(): string | null {
  if (!existsSync(TURBO_PKG_JSON)) return null;
  try {
    const pkg = JSON.parse(readFileSync(TURBO_PKG_JSON, 'utf8')) as {
      version?: string;
    };
    const version = pkg.version?.trim();
    return version !== undefined && version.length > 0 ? version : null;
  } catch {
    return null;
  }
}

function resolveLatestTurboVersion(): string {
  const r = capture('bun', ['pm', 'view', 'turbo', 'version'], {
    cwd: REPO_ROOT,
  });
  const latest = r.stdout.trim();
  if (r.status !== 0 || latest.length === 0) {
    throw new Error(
      `could not resolve latest turbo version (exit ${String(r.status)}; stderr: ${summarize(r.stderr)})`
    );
  }
  return latest;
}

function writeCatalogTurboRange(latest: string): void {
  const raw = readFileSync(ROOT_PACKAGE_JSON, 'utf8');
  const next = raw.replace(CATALOG_TURBO_RE, `$1${latest}$2`);
  if (next === raw) {
    throw new Error('could not update catalog.turbo in package.json');
  }
  writeFileSync(ROOT_PACKAGE_JSON, next, 'utf8');
}

function syncWorkspaceTurbo(latest: string): void {
  writeCatalogTurboRange(latest);
  run('bun', ['install'], { cwd: REPO_ROOT });
}

export class TurboDep implements Dep {
  readonly name = 'turbo';
  readonly bin = 'turbo';

  version(): string | null {
    return readWorkspaceTurboVersion();
  }

  check(): DepStatus {
    const pkgVersion = readWorkspaceTurboVersion();
    if (pkgVersion === null) {
      return {
        ok: false,
        reason:
          'workspace turbo not installed — run `bun install` at the repo root',
      };
    }

    if (!existsSync(TURBO_BIN)) {
      return {
        ok: false,
        reason: 'workspace turbo binary missing in node_modules/.bin/turbo',
      };
    }

    const d = captureVersionDiagnostic(TURBO_BIN, ['--version']);
    if (d.status !== 0) {
      return {
        ok: false,
        reason:
          `workspace turbo failed (\`${TURBO_BIN} --version\` exited ${String(d.status)}; ` +
          `stdout: ${summarize(d.stdout)}; stderr: ${summarize(d.stderr)})`,
      };
    }

    return { ok: true, version: pkgVersion };
  }

  async fetchLatestVersion(): Promise<string | null> {
    try {
      const res = await fetch('https://registry.npmjs.org/turbo/latest', {
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
    run('bun', ['install'], { cwd: REPO_ROOT });
  }

  upgrade(): void {
    syncWorkspaceTurbo(resolveLatestTurboVersion());
  }

  verify(): void {
    if (!existsSync(TURBO_BIN)) {
      throw new Error(
        'workspace turbo binary not found — run `bun install` at the repo root'
      );
    }
    verifyRun(TURBO_BIN, ['--version']);
  }
}
