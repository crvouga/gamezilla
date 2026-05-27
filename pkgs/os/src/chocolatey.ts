import { run, runOk, which } from './command';
import type { PackageManager } from './package-manager';

/** Windows `choco` (Chocolatey) package manager. Install operations need elevation. */
export class Chocolatey implements PackageManager {
  readonly id = 'chocolatey';

  isAvailable(): boolean {
    return which('choco');
  }

  isInstalled(pkg: string): boolean {
    return runOk('choco', ['list', '--local-only', '--exact', pkg]);
  }

  install(pkg: string): void {
    run('choco', ['install', '-y', pkg]);
  }

  upgrade(pkg: string): void {
    run('choco', ['upgrade', '-y', pkg]);
  }
}
