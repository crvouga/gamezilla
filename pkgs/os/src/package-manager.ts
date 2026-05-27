/**
 * A system package manager (`brew`, `apt`, `dnf`, `winget`, …). The abstraction
 * intentionally exposes only the four operations every PM supports the same
 * way; PM-specific quirks (Homebrew taps, keg-only bin dirs) live on the
 * concrete class and are accessed via the concrete type, not this interface.
 */
export interface PackageManager {
  /** Stable id used to look up per-PM package names in {@link PackageManagerInstaller}. */
  readonly id: string;
  /** True if the PM binary is installed on this machine (so we can dispatch to it). */
  isAvailable(): boolean;
  /** True if `pkg` is already installed via this PM. */
  isInstalled(pkg: string): boolean;
  install(pkg: string): void;
  upgrade(pkg: string): void;
}
