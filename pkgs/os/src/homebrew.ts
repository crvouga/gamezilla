import { join } from 'node:path';
import { capture, run, runOk, which } from './command';
import type { PathExists } from './os-fs';
import type { PackageManager } from './package-manager';

/**
 * macOS Homebrew. The plain {@link PackageManager} methods cover the common
 * `brew install <pkg>` / `brew upgrade <pkg>` path; the extra methods on this
 * class (`tap`, `unlink`, `linkOverwrite`, `binDirFor`) exist for the handful
 * of formulas with non-standard install layouts:
 *
 * - `tap(name)` for third-party formulas (e.g. `stripe/stripe-cli`).
 * - `unlink(pkg)` / `linkOverwrite(pkg)` to resolve legacy-formula collisions
 *   (e.g. moving from `stripe-cli` to `stripe`).
 * - `binDirFor(pkg)` to discover the bin dir of keg-only formulas like
 *   `postgresql@18` that aren't on the default PATH after install.
 */
const KEG_BIN_PREFIXES: readonly string[] = [
  '/opt/homebrew/opt',
  '/usr/local/opt',
];

export class Homebrew implements PackageManager {
  readonly id = 'homebrew';

  constructor(private readonly pathExists: PathExists = () => false) {}

  isAvailable(): boolean {
    return which('brew');
  }

  isInstalled(pkg: string): boolean {
    return runOk('brew', ['list', '--formula', pkg]);
  }

  install(pkg: string): void {
    run('brew', ['install', pkg]);
  }

  upgrade(pkg: string): void {
    if (this.isInstalled(pkg)) {
      run('brew', ['upgrade', pkg]);
      return;
    }
    run('brew', ['install', pkg]);
  }

  uninstall(pkg: string): void {
    if (!this.isInstalled(pkg)) return;
    run('brew', ['uninstall', '--formula', pkg]);
  }

  tap(name: string): void {
    run('brew', ['tap', name]);
  }

  unlink(pkg: string): void {
    run('brew', ['unlink', pkg]);
  }

  linkOverwrite(pkg: string): void {
    run('brew', ['link', '--overwrite', pkg]);
  }

  /**
   * Bin dir for a keg-only formula (e.g. `postgresql@18`). Tries
   * `brew --prefix <pkg>` first for an authoritative answer, then falls back
   * to scanning the standard Apple-Silicon and Intel install prefixes so
   * callers don't false-negative right after `brew install`.
   */
  binDirFor(pkg: string): string | null {
    const prefixOut = capture('brew', ['--prefix', pkg]);
    if (prefixOut.status === 0) {
      const prefix = prefixOut.stdout.trim();
      if (prefix.length > 0) {
        const dir = join(prefix, 'bin');
        if (this.pathExists(dir)) return dir;
      }
    }
    for (const prefix of KEG_BIN_PREFIXES) {
      const dir = join(prefix, pkg, 'bin');
      if (this.pathExists(dir)) return dir;
    }
    return null;
  }
}
