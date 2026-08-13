import { join } from 'node:path';
import { capture, run, whichPath } from './command';
import type { Installer } from './installer';
import type { PathExists } from './os-fs';

export interface NpmGlobalInstallerOptions {
  readonly pkg: string;
  readonly pathExists?: PathExists;
  /** npm dist-tag or version (default `latest`). */
  readonly tag?: string;
  /**
   * Binary name on PATH. When set, install/upgrade targets the package manager
   * that owns that binary (bun global vs npm global) so PATH stays in sync.
   */
  readonly bin?: string;
}

type NpmListGlobalJson = {
  dependencies?: Record<string, { version?: string }>;
};

function isBunGlobalPath(binPath: string): boolean {
  return /(^|[\\/])\.bun([\\/]|$)/.test(binPath);
}

/**
 * Global install for npm-published CLIs (`wrangler`, `eas-cli`, …).
 * Prefers `npm install -g` for fresh installs; when {@link NpmGlobalInstallerOptions.bin}
 * resolves to a bun-managed binary, uses `bun add -g` so upgrade updates PATH.
 */
export class NpmGlobalInstaller implements Installer {
  constructor(private readonly opts: NpmGlobalInstallerOptions) {}

  install(): void {
    this.installViaPreferredManager();
  }

  upgrade(): void {
    this.installViaPreferredManager();
  }

  /** Installed semver from `npm list -g <pkg> --json` (not the binary `--version`). */
  installedVersion(): string | null {
    const r = capture('npm', [
      'list',
      '-g',
      this.opts.pkg,
      '--depth=0',
      '--json',
    ]);
    if (r.status !== 0 && r.stdout.trim().length === 0) return null;
    try {
      const j = JSON.parse(r.stdout) as NpmListGlobalJson;
      const v = j.dependencies?.[this.opts.pkg]?.version?.trim();
      return v !== undefined && v.length > 0 ? v : null;
    } catch {
      return null;
    }
  }

  /** Absolute path to the global binary (`$(npm prefix -g)/bin/<pkg>`). */
  globalBinPath(): string | null {
    const prefix = this.globalPrefix();
    if (prefix === null) return null;
    const bin = join(prefix, 'bin', this.opts.pkg);
    return this.pathExists(bin) ? bin : null;
  }

  private pathExists(path: string): boolean {
    return this.opts.pathExists?.(path) ?? false;
  }

  private installViaPreferredManager(): void {
    if (this.shouldUseBun()) {
      this.runBun();
      return;
    }
    this.runNpm();
  }

  private shouldUseBun(): boolean {
    const bin = this.opts.bin;
    if (bin === undefined) return false;
    const path = whichPath(bin);
    return path !== null && isBunGlobalPath(path);
  }

  private globalPrefix(): string | null {
    const r = capture('npm', ['prefix', '-g']);
    if (r.status !== 0) return null;
    const prefix = r.stdout.trim();
    return prefix.length > 0 ? prefix : null;
  }

  private packageSpec(): string {
    const tag = this.opts.tag ?? 'latest';
    return `${this.opts.pkg}@${tag}`;
  }

  private runNpm(): void {
    run('npm', ['install', '-g', this.packageSpec()]);
  }

  private runBun(): void {
    run('bun', ['add', '-g', this.packageSpec()]);
  }
}
