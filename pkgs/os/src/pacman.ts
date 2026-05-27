import { runOk, which } from './command';
import type { PackageManager } from './package-manager';
import { runAsRoot } from './sudo';

/** Arch Linux `pacman` package manager. */
export class Pacman implements PackageManager {
  readonly id = 'pacman';

  isAvailable(): boolean {
    return which('pacman');
  }

  isInstalled(pkg: string): boolean {
    return runOk('pacman', ['-Qi', pkg]);
  }

  install(pkg: string): void {
    runAsRoot('pacman', ['-S', '--noconfirm', pkg]);
  }

  upgrade(pkg: string): void {
    runAsRoot('pacman', ['-Syu', '--noconfirm', pkg]);
  }
}
