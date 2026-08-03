import { currentOs } from './current-os';
import { Homebrew } from './homebrew';
import type { Installer } from './installer';
import type { Os } from './os';
import type { PackageManager } from './package-manager';

/**
 * A single PM-targeted install spec. `package` is the package name as that
 * PM names it (e.g. `postgresql@18` for Homebrew, `postgresql` for apt,
 * `PostgreSQL.PostgreSQL` for winget).
 *
 * Homebrew-specific convenience knobs:
 * - `homebrewTap` — run `brew tap <tap>` before install (third-party formulas).
 * - `homebrewLinkOverwrite` — run `brew link --overwrite <linkAs>` after install
 *   to resolve filename collisions with previously-installed formulas.
 */
export interface PackageManagerInstallEntry {
  readonly packageManagerId: string;
  readonly package: string;
  readonly homebrewTap?: string;
  readonly homebrewLinkOverwrite?: string;
  /**
   * Homebrew formulas to uninstall before install/upgrade (same short name from
   * another tap, e.g. `homebrew/core` `foo` vs `vendor/tap/foo`).
   */
  readonly homebrewUninstallConflicts?: readonly string[];
}

export interface PackageManagerInstallerOptions {
  readonly entries: readonly PackageManagerInstallEntry[];
  /** Test seam: inject a specific `Os` instead of the detected one. */
  readonly os?: Os;
}

/**
 * Resolve the current OS, find the first install entry whose PM is available,
 * and dispatch `install`/`upgrade` to it. Throws when no entry's PM is
 * available so a wrapping {@link FirstAvailableInstaller} can fall through.
 */
export class PackageManagerInstaller implements Installer {
  constructor(private readonly opts: PackageManagerInstallerOptions) {}

  install(): void {
    const { entry, pm } = this.resolve();
    this.prepare(pm, entry);
    pm.install(entry.package);
    this.finalize(pm, entry);
  }

  upgrade(): void {
    const { entry, pm } = this.resolve();
    this.prepare(pm, entry);
    pm.upgrade(entry.package);
    this.finalize(pm, entry);
  }

  private resolve(): {
    readonly entry: PackageManagerInstallEntry;
    readonly pm: PackageManager;
  } {
    const os = this.opts.os ?? currentOs();
    for (const entry of this.opts.entries) {
      const pm = os.packageManager(entry.packageManagerId);
      if (pm !== null && pm.isAvailable()) return { entry, pm };
    }
    const tried = this.opts.entries.map((e) => e.packageManagerId).join(', ');
    throw new Error(
      `no available package manager (tried: ${tried}) on ${os.platform}`
    );
  }

  private prepare(pm: PackageManager, entry: PackageManagerInstallEntry): void {
    if (!(pm instanceof Homebrew)) return;
    const conflicts = entry.homebrewUninstallConflicts;
    if (conflicts !== undefined && !pm.isInstalled(entry.package)) {
      for (const pkg of conflicts) {
        pm.uninstall(pkg);
      }
    }
    if (entry.homebrewTap !== undefined) {
      pm.tap(entry.homebrewTap);
    }
  }

  private finalize(
    pm: PackageManager,
    entry: PackageManagerInstallEntry
  ): void {
    if (entry.homebrewLinkOverwrite !== undefined && pm instanceof Homebrew) {
      pm.linkOverwrite(entry.homebrewLinkOverwrite);
    }
  }
}
