import { chmodSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { capture, run } from './command';
import { currentOs } from './current-os';
import type { Installer } from './installer';
import type { Os } from './os';

const UA = 'pkgs-os-github-release-installer';
const FETCH_TIMEOUT_MS = 15_000;

export interface GithubReleaseArchive {
  /** Archive filename inside the release (`stripe_1.42.0_linux_x86_64.tar.gz`). */
  readonly name: string;
  /** Archive format. Drives the extraction command. */
  readonly format: 'tar.gz' | 'zip';
}

export interface GithubReleaseTarballInstallerOptions {
  /** Repo `owner/name` (e.g. `stripe/stripe-cli`). */
  readonly repo: string;
  /** Bin name to chmod +x and verify presence of after extraction. */
  readonly binName: string;
  /** Derive the archive name + format from the resolved version + os. */
  readonly archive: (version: string, os: Os) => GithubReleaseArchive;
  /** Where to drop the extracted binary. Default `os.defaultBinDir()`. */
  readonly installDir?: string;
  /** Test seam: inject a specific `Os`. */
  readonly os?: Os;
}

/**
 * Download + extract the latest GitHub Release archive for a binary into the
 * user-scope bin dir (PATH-resident on a normal login). Used for tools that
 * don't have a system-wide PM (or whose PM packages lag upstream).
 *
 * Strategy: resolve `releases/latest` via the GitHub API, then shell out to
 * `curl` + `tar` / `unzip` for the actual download + extract. This keeps the
 * dependency surface to one native binary per OS that's universally present.
 */
export class GithubReleaseTarballInstaller implements Installer {
  constructor(private readonly opts: GithubReleaseTarballInstallerOptions) {}

  install(): void {
    this.fetchAndExtract();
  }

  upgrade(): void {
    this.fetchAndExtract();
  }

  private fetchAndExtract(): void {
    const os = this.opts.os ?? currentOs();
    const installDir = this.opts.installDir ?? os.defaultBinDir();
    const version = resolveLatestSync(this.opts.repo);
    if (version === null) {
      throw new Error(`failed to resolve latest release for ${this.opts.repo}`);
    }
    const archive = this.opts.archive(version, os);
    const url = `https://github.com/${this.opts.repo}/releases/download/v${version}/${archive.name}`;
    mkdirSync(installDir, { recursive: true });
    extractTo(installDir, url, archive, this.opts.binName);
    const binPath = join(
      installDir,
      os.platform === 'win32' ? `${this.opts.binName}.exe` : this.opts.binName
    );
    if (os.platform !== 'win32') chmodSync(binPath, 0o755);
  }
}

function extractTo(
  installDir: string,
  url: string,
  archive: GithubReleaseArchive,
  binName: string
): void {
  const dir = shellQuote(installDir);
  const u = shellQuote(url);
  if (archive.format === 'tar.gz') {
    run('bash', [
      '-lc',
      `curl -fsSL ${u} | tar -xz -C ${dir} ${shellQuote(binName)}`,
    ]);
    return;
  }
  // zip: download to a temp file, unzip the target binary, drop the temp file.
  const tmp = `${installDir}/.${binName}.download.zip`;
  const t = shellQuote(tmp);
  run('bash', [
    '-lc',
    `curl -fsSL -o ${t} ${u} && unzip -o ${t} ${shellQuote(binName)} -d ${dir} && rm -f ${t}`,
  ]);
}

function shellQuote(s: string): string {
  if (/^[\w./:@%+=-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/**
 * Sync version of the existing async pattern in `bun.ts` / `stripe.ts` /
 * `pgweb.ts`. We need a sync API because `Installer.install()` is sync (it's
 * called from `Dep.install()`, which `setup` invokes synchronously).
 *
 * Prefer the HTML redirect (`/releases/latest` → `/releases/tag/vX.Y.Z`) over
 * the GitHub REST API: shared CI runners often exhaust the unauthenticated API
 * quota (60 req/hr), which made Infisical installs fail with
 * "failed to resolve latest release". The redirect path is not rate-limited the
 * same way. Fall back to the API (with `GITHUB_TOKEN` / `GH_TOKEN` when set).
 */
function resolveLatestSync(repo: string): string | null {
  return resolveLatestViaRedirect(repo) ?? resolveLatestViaApi(repo);
}

function parseReleaseTag(tag: string): string | null {
  const m = /^v?([\d]+\.[\d]+[\w.+-]*)$/.exec(tag.trim());
  return m?.[1]?.trim() ?? null;
}

/** `https://github.com/<repo>/releases/latest` → `…/tag/vX.Y.Z`. */
function resolveLatestViaRedirect(repo: string): string | null {
  const r = capture('curl', [
    '-fsSL',
    '-o',
    '/dev/null',
    '-w',
    '%{url_effective}',
    '--max-time',
    String(Math.ceil(FETCH_TIMEOUT_MS / 1000)),
    `https://github.com/${repo}/releases/latest`,
  ]);
  if (r.status !== 0) return null;
  const m = /\/releases\/tag\/(v?[\d]+\.[\d]+[\w.+-]*)$/.exec(r.stdout.trim());
  return m?.[1] !== undefined ? parseReleaseTag(m[1]) : null;
}

function resolveLatestViaApi(repo: string): string | null {
  const args = [
    '-fsSL',
    '-H',
    `User-Agent: ${UA}`,
    '-H',
    'Accept: application/vnd.github+json',
    '--max-time',
    String(Math.ceil(FETCH_TIMEOUT_MS / 1000)),
  ];
  const token = (
    process.env['GITHUB_TOKEN'] ??
    process.env['GH_TOKEN'] ??
    ''
  ).trim();
  if (token.length > 0) {
    args.push('-H', `Authorization: Bearer ${token}`);
  }
  args.push(`https://api.github.com/repos/${repo}/releases/latest`);
  const r = capture('curl', args);
  if (r.status !== 0) return null;
  try {
    const j = JSON.parse(r.stdout) as { tag_name?: string };
    return parseReleaseTag(j.tag_name ?? '');
  } catch {
    return null;
  }
}
