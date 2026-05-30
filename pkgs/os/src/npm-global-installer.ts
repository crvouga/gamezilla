import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { capture, run } from './command';
import type { Installer } from './installer';

export interface NpmGlobalInstallerOptions {
  readonly pkg: string;
  /** npm dist-tag or version (default `latest`). */
  readonly tag?: string;
}

type NpmListGlobalJson = {
  dependencies?: Record<string, { version?: string }>;
};

/**
 * `npm install -g <pkg>@<tag>`. Works on every OS Node ships on, so this
 * doubles as a cross-platform install for any tool published to npm
 * (wrangler, prettier, …). Upgrade is the same operation: npm reinstalls
 * over an existing global.
 */
export class NpmGlobalInstaller implements Installer {
  constructor(private readonly opts: NpmGlobalInstallerOptions) {}

  install(): void {
    this.runNpm();
  }

  upgrade(): void {
    this.runNpm();
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
    return existsSync(bin) ? bin : null;
  }

  private globalPrefix(): string | null {
    const r = capture('npm', ['prefix', '-g']);
    if (r.status !== 0) return null;
    const prefix = r.stdout.trim();
    return prefix.length > 0 ? prefix : null;
  }

  private runNpm(): void {
    const tag = this.opts.tag ?? 'latest';
    run('npm', ['install', '-g', `${this.opts.pkg}@${tag}`]);
  }
}
