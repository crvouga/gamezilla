import { homedir } from 'node:os';
import { join } from 'node:path';
import { Apt } from './apt';
import { Dnf } from './dnf';
import type { Os } from './os';
import type { PackageManager } from './package-manager';
import { Pacman } from './pacman';
import type { Arch, Platform } from './platform';

/** Linux. Three first-party PMs in order of distro share: apt, dnf, pacman. */
export class LinuxOs implements Os {
  readonly platform: Platform = 'linux';
  readonly packageManagers: readonly PackageManager[];

  constructor(private readonly arch: Arch) {
    this.packageManagers = [new Apt(), new Dnf(), new Pacman()];
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
    return 'linux';
  }

  releaseArchName(): Arch {
    return this.arch;
  }
}
