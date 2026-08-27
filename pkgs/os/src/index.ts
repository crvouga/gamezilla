export { Apt } from './apt';
export { Chocolatey } from './chocolatey';
export type { CliDep } from './cli-dep';
export { installCliDeps, sortCliDeps } from './cli-dep';
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
export type { CurlScriptInstallerOptions } from './curl-script-installer';
export { CurlScriptInstaller } from './curl-script-installer';
export { _resetCurrentOsForTesting, currentOs } from './current-os';
export { Dnf } from './dnf';
export { FirstAvailableInstaller } from './first-available-installer';
export type {
  GithubReleaseArchive,
  GithubReleaseTarballInstallerOptions,
} from './github-release-installer';
export { GithubReleaseTarballInstaller } from './github-release-installer';
export { Homebrew } from './homebrew';
export type { Installer } from './installer';
export {
  killAllEsbuildServices,
  killOrphanEsbuildServices,
} from './kill-orphan-esbuild';
export { killListenersOnPort, killListenersOnPorts } from './kill-port';
export { LinuxOs } from './linux-os';
export { MacOs } from './mac-os';
export type { NpmGlobalInstallerOptions } from './npm-global-installer';
export { NpmGlobalInstaller } from './npm-global-installer';
export type { Os } from './os';
export type { OsFs, PathExists } from './os-fs';
export type { PackageManager } from './package-manager';
export type {
  PackageManagerInstallEntry,
  PackageManagerInstallerOptions,
} from './package-manager-installer';
export { PackageManagerInstaller } from './package-manager-installer';
export { Pacman } from './pacman';
export type { Arch, Platform } from './platform';
export { currentArch, currentPlatform } from './platform';
export { Scoop } from './scoop';
export { runAsRoot } from './sudo';
export { wallOsFs } from './wall-os-fs';
export { WindowsOs } from './windows-os';
export { Winget } from './winget';
