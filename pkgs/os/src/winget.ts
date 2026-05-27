import { run, runOk, which } from './command';
import type { PackageManager } from './package-manager';

/** Microsoft `winget` (Windows Package Manager). */
export class Winget implements PackageManager {
  readonly id = 'winget';

  isAvailable(): boolean {
    return which('winget');
  }

  isInstalled(pkg: string): boolean {
    return runOk('winget', ['list', '--exact', '--id', pkg]);
  }

  install(pkg: string): void {
    run('winget', [
      'install',
      '--exact',
      '--id',
      pkg,
      '--accept-package-agreements',
      '--accept-source-agreements',
    ]);
  }

  upgrade(pkg: string): void {
    run('winget', [
      'upgrade',
      '--exact',
      '--id',
      pkg,
      '--accept-package-agreements',
      '--accept-source-agreements',
    ]);
  }
}
