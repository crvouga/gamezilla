import { run } from './command';
import type { Installer } from './installer';

export interface NpmGlobalInstallerOptions {
  readonly pkg: string;
  /** npm dist-tag or version (default `latest`). */
  readonly tag?: string;
}

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

  private runNpm(): void {
    const tag = this.opts.tag ?? 'latest';
    run('npm', ['install', '-g', `${this.opts.pkg}@${tag}`]);
  }
}
