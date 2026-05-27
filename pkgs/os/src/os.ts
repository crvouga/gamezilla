import type { PackageManager } from './package-manager';
import type { Arch, Platform } from './platform';

/**
 * Operating system abstraction. Each concrete subclass advertises the
 * package managers conventionally available on that platform, the binary
 * install directory user-scope installers should target, and the naming
 * conventions GitHub Release archives use for that OS / arch.
 *
 * The factory that returns the current OS lives in `./current-os` so this
 * file stays a pure interface declaration with no edges back to concrete
 * subclasses (avoids a circular-import gate failure).
 */
export interface Os {
  readonly platform: Platform;
  /** Package managers conventionally available on this OS, in preferred order. */
  readonly packageManagers: readonly PackageManager[];
  /** First available PM, or null if none are installed. */
  preferredPackageManager(): PackageManager | null;
  /** Find a PM by id, regardless of whether it's installed. */
  packageManager(id: string): PackageManager | null;
  /** User-scope bin dir installers should drop binaries into (already on PATH for normal logins). */
  defaultBinDir(): string;
  /** OS-name string in conventional GitHub Release archives (`darwin` / `linux` / `windows`). */
  releaseOsName(): string;
  /** Arch-name string in conventional GitHub Release archives (`x86_64` / `arm64`). */
  releaseArchName(): Arch;
}
