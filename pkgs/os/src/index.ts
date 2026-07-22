export type {
  CaptureResult,
  CaptureVersionDiagnostic,
  RunOptions,
} from './command';
export {
  capture,
  captureVersion,
  captureVersionDiagnostic,
  run,
  runOk,
  verifyRun,
  which,
  whichPath,
} from './command';
export { CurlScriptInstaller } from './curl-script-installer';
export type { CurlScriptInstallerOptions } from './curl-script-installer';
export { FirstAvailableInstaller } from './first-available-installer';
export type {
  GithubReleaseArchive,
  GithubReleaseTarballInstallerOptions,
} from './github-release-installer';
export { GithubReleaseTarballInstaller } from './github-release-installer';
export { Homebrew } from './homebrew';
export { Apt } from './apt';
export { Dnf } from './dnf';
export { Pacman } from './pacman';
export { Winget } from './winget';
export { Scoop } from './scoop';
export { Chocolatey } from './chocolatey';
export type { Installer } from './installer';
export { LinuxOs } from './linux-os';
export { MacOs } from './mac-os';
export { NpmGlobalInstaller } from './npm-global-installer';
export type { NpmGlobalInstallerOptions } from './npm-global-installer';
export { _resetCurrentOsForTesting, currentOs } from './current-os';
export type { Os } from './os';
export type { PackageManager } from './package-manager';
export type {
  PackageManagerInstallEntry,
  PackageManagerInstallerOptions,
} from './package-manager-installer';
export { PackageManagerInstaller } from './package-manager-installer';
export type { Arch, Platform } from './platform';
export { currentArch, currentPlatform } from './platform';
export { killListenersOnPort, killListenersOnPorts } from './kill-port';
export { runAsRoot } from './sudo';
export { WindowsOs } from './windows-os';
