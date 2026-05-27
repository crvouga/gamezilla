import { homedir } from 'node:os';
import { join } from 'node:path';
import { Homebrew } from './homebrew';
import type { Os } from './os';
import type { PackageManager } from './package-manager';
import type { Arch, Platform } from './platform';

/** macOS. Only first-party package manager treated as canonical is Homebrew. */
export class MacOs implements Os {
  readonly platform: Platform = 'darwin';
  readonly packageManagers: readonly PackageManager[];

  constructor(private readonly arch: Arch) {
    this.packageManagers = [new Homebrew()];
  }

  preferredPackageManager(): PackageManager | null {
    return this.packageManagers.find((p) => p.isAvailable()) ?? null;
  }

  packageManager(id: string): PackageManager | null {
    return this.packageManagers.find((p) => p.id === id) ?? null;
  }

  defaultBinDir(): string {
    return join(homedir(), '.local', 'bin');
  }

  releaseOsName(): string {
    return 'darwin';
  }

  releaseArchName(): Arch {
    return this.arch;
  }
}
