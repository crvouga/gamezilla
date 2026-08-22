#!/usr/bin/env bun
// @io-wall-ok — tools composition root
import {
  captureVersionDiagnostic,
  NpmGlobalInstaller,
  verifyRun,
  wallOsFs,
  which,
} from '@pkgs/os';

function installCli(pkg: string, bin: string): void {
  const installer = new NpmGlobalInstaller({
    pkg,
    bin,
    tag: 'latest',
    pathExists: wallOsFs().pathExists,
  });
  if (!which(bin)) {
    installer.install();
  }
  verifyRun(bin, ['--version']);
  const version = captureVersionDiagnostic(bin, ['--version']).version;
  console.log(`${bin}: ${version ?? 'installed'}`);
}

installCli('wrangler', 'wrangler');
installCli('eas-cli', 'eas');
