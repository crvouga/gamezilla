/**
 * Install strategy. Each strategy knows how to install / upgrade a single
 * binary via a particular mechanism (a package manager, a curl|bash script,
 * a GitHub release tarball, …). Strategies are composable via
 * {@link FirstAvailableInstaller}, which tries each in order until one
 * succeeds.
 *
 * `install()` and `upgrade()` should throw if the strategy cannot proceed
 * (e.g. no matching package manager is available) so the composite installer
 * can fall through to the next option.
 */
export interface Installer {
  install(): void;
  upgrade(): void;
}
