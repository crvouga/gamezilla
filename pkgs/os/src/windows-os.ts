import { homedir } from 'node:os';
import { join } from 'node:path';
import { Chocolatey } from './chocolatey';
import type { Os } from './os';
import type { PackageManager } from './package-manager';
import type { Arch, Platform } from './platform';
import { Scoop } from './scoop';
import { Winget } from './winget';

/** Windows. Three first-party PMs in order of friction: winget, scoop, choco. */
export class WindowsOs implements Os {
  readonly platform: Platform = 'win32';
  readonly packageManagers: readonly PackageManager[];

  constructor(private readonly arch: Arch) {
    this.packageManagers = [new Winget(), new Scoop(), new Chocolatey()];
  }

  preferredPackageManager(): PackageManager | null {
    return this.packageManagers.find((p) => p.isAvailable()) ?? null;
  }

  packageManager(id: string): PackageManager | null {
    return this.packageManagers.find((p) => p.id === id) ?? null;
  }

  defaultBinDir(): string {
    return join(homedir(), 'AppData', 'Local', 'Microsoft', 'WindowsApps');
  }

  releaseOsName(): string {
    return 'windows';
  }

  releaseArchName(): Arch {
    return this.arch;
  }
}
