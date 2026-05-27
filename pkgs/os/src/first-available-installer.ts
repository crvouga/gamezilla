import type { Installer } from './installer';

/**
 * Compose multiple {@link Installer} strategies. `install()` tries each in
 * order, returning on the first one that doesn't throw; if all fail, throws
 * an error with `manualHint` so the user has an actionable next step. Same
 * fallthrough rules apply to `upgrade()`.
 *
 * Strategy ordering convention: cheapest / most-conventional first (system
 * package manager), tarball / curl-script fallbacks last.
 */
export class FirstAvailableInstaller implements Installer {
  constructor(
    private readonly installers: readonly Installer[],
    private readonly manualHint: string
  ) {}

  install(): void {
    this.tryEach('install');
  }

  upgrade(): void {
    this.tryEach('upgrade');
  }

  private tryEach(method: 'install' | 'upgrade'): void {
    const failures: string[] = [];
    for (const installer of this.installers) {
      try {
        installer[method]();
        return;
      } catch (e) {
        failures.push(e instanceof Error ? e.message : String(e));
      }
    }
    const detail = failures.length > 0 ? `\n  - ${failures.join('\n  - ')}` : '';
    throw new Error(`${this.manualHint}${detail}`);
  }
}
