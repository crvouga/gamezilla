import { run, runOk, which } from './command';
import type { PackageManager } from './package-manager';

/** Windows `scoop` package manager (user-scope installs). */
export class Scoop implements PackageManager {
  readonly id = 'scoop';

  isAvailable(): boolean {
    return which('scoop');
  }

  isInstalled(pkg: string): boolean {
    return runOk('scoop', ['list', pkg]);
  }

  install(pkg: string): void {
    run('scoop', ['install', pkg]);
  }

  upgrade(pkg: string): void {
    if (this.isInstalled(pkg)) {
      run('scoop', ['update', pkg]);
      return;
    }
    run('scoop', ['install', pkg]);
  }
}
