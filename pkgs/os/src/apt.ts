import { runOk, which } from './command';
import type { PackageManager } from './package-manager';
import { runAsRoot } from './sudo';

/** Debian/Ubuntu `apt-get` package manager. Install operations require root. */
export class Apt implements PackageManager {
  readonly id = 'apt';

  isAvailable(): boolean {
    return which('apt-get');
  }

  isInstalled(pkg: string): boolean {
    return runOk('dpkg', ['-s', pkg]);
  }

  install(pkg: string): void {
    runAsRoot('apt-get', ['install', '-y', pkg]);
  }

  upgrade(pkg: string): void {
    runAsRoot('apt-get', ['install', '--only-upgrade', '-y', pkg]);
  }
}
