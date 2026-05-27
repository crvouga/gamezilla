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
 * called from `Dep.install()`, which `setup` invokes synchronously). Uses
 * `XMLHttpRequest`-free fetch via curl to avoid a bun-only sync HTTP API.
 */
function resolveLatestSync(repo: string): string | null {
  const r = capture('curl', [
    '-fsSL',
    '-H',
    `User-Agent: ${UA}`,
    '-H',
    'Accept: application/vnd.github+json',
    '--max-time',
    String(Math.ceil(FETCH_TIMEOUT_MS / 1000)),
    `https://api.github.com/repos/${repo}/releases/latest`,
  ]);
  if (r.status !== 0) return null;
  try {
    const j = JSON.parse(r.stdout) as { tag_name?: string };
    const tag = j.tag_name?.trim() ?? '';
    const m = /^v?([\d]+\.[\d]+[\w.+-]*)$/.exec(tag);
    return m?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}
