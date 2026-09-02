import { join } from 'node:path';
import { capture, run, runOk } from './command';
import { currentOs } from './current-os';
import type { Installer } from './installer';
import type { Os } from './os';
import { missingOsFs, type OsFs } from './os-fs';

const UA = 'pkgs-os-github-release-installer';
const FETCH_TIMEOUT_MS = 15_000;

export interface GithubReleaseArchive {
  /** Archive filename inside the release (`tool_1.0.0_linux_x86_64.tar.gz`). */
  readonly name: string;
  /** Archive format. Drives the extraction command. */
  readonly format: 'tar.gz' | 'zip';
}

export interface GithubReleaseTarballInstallerOptions {
  /** Repo `owner/name` (e.g. `owner/tool-cli`). */
  readonly repo: string;
  /** Bin name to chmod +x and verify presence of after extraction. */
  readonly binName: string;
  /** Derive the archive name + format from the resolved version + os. */
  readonly archive: (version: string, os: Os) => GithubReleaseArchive;
  /**
   * Pin a release version (no leading `v`). When omitted, resolves
   * `releases/latest`.
   */
  readonly version?: string;
  /** Where to drop the extracted binary. Default `os.defaultBinDir()`. */
  readonly installDir?: string;
  /** Test seam: inject a specific `Os`. */
  readonly os?: Os;
  /** Injected filesystem operations for install-dir creation and chmod. */
  readonly osFs?: OsFs;
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
    const osFs = this.opts.osFs ?? missingOsFs;
    const pinned = this.opts.version?.trim();
    const version =
      pinned !== undefined && pinned.length > 0
        ? pinned.replace(/^v/, '')
        : resolveLatestSync(this.opts.repo);
    if (version === null) {
      throw new Error(`failed to resolve latest release for ${this.opts.repo}`);
    }
    const archive = this.opts.archive(version, os);
    const url = `https://github.com/${this.opts.repo}/releases/download/v${version}/${archive.name}`;
    osFs.mkdirpSync(installDir);
    extractTo(installDir, url, archive, this.opts.binName);
    const binPath = join(
      installDir,
      os.platform === 'win32' ? `${this.opts.binName}.exe` : this.opts.binName
    );
    if (os.platform !== 'win32') osFs.chmodSync(binPath, 0o755);
    if (os.platform === 'darwin') allowMacUnsignedBinary(binPath);
  }
}

/** GitHub tarballs are unsigned; macOS Gatekeeper SIGKILLs them on exec. */
function allowMacUnsignedBinary(binPath: string): void {
  runOk('xattr', ['-c', binPath]);
  runOk('codesign', ['--sign', '-', '--force', binPath]);
}

function extractTo(
  installDir: string,
  url: string,
  archive: GithubReleaseArchive,
  binName: string
): void {
  const dir = shellQuote(installDir);
  const u = shellQuote(url);
  const bin = shellQuote(binName);
  const stage = shellQuote(`${installDir}/.${binName}.stage`);
  const pack = shellQuote(`${installDir}/.${binName}.archive`);
  const unpack =
    archive.format === 'tar.gz'
      ? `tar -xzf ${pack} -C ${stage} ${bin}`
      : `unzip -o ${pack} ${bin} -d ${stage}`;
  // Download fully, then extract to a staging dir, then mv into place so a
  // killed install cannot leave a truncated binary on PATH.
  run('bash', [
    '-lc',
    `set -euo pipefail
rm -rf ${stage} ${pack}
mkdir -p ${stage}
curl -fsSL -o ${pack} ${u}
${unpack}
rm -f ${pack}
mv -f ${stage}/${bin} ${dir}/${bin}
rmdir ${stage}`,
  ]);
}

function shellQuote(s: string): string {
  if (/^[\w./:@%+=-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/**
 * Sync version of the existing async pattern in `bun.ts` / install helpers /
 * `pgweb.ts`. We need a sync API because `Installer.install()` is sync (it's
 * called from `Dep.install()`, which `setup` invokes synchronously).
 *
 * Prefer the HTML redirect (`/releases/latest` → `/releases/tag/vX.Y.Z`) over
 * the GitHub REST API: shared CI runners often exhaust the unauthenticated API
 * quota (60 req/hr), which made installs fail with "failed to resolve latest
 * release". The redirect path is not rate-limited the same way. Fall back to
 * the API (with `GITHUB_TOKEN` / `GH_TOKEN` when set).
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
