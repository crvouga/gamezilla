import { runOk, which } from './command';
import type { PackageManager } from './package-manager';
import { runAsRoot } from './sudo';

/** Fedora/RHEL `dnf` package manager. */
export class Dnf implements PackageManager {
  readonly id = 'dnf';

  isAvailable(): boolean {
    return which('dnf');
  }

  isInstalled(pkg: string): boolean {
    return runOk('rpm', ['-q', pkg]);
  }

  install(pkg: string): void {
    runAsRoot('dnf', ['install', '-y', pkg]);
  }

  upgrade(pkg: string): void {
    runAsRoot('dnf', ['upgrade', '-y', pkg]);
  }
}
