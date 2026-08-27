import { NpmGlobalInstaller, wallOsFs, which } from '@pkgs/os';
import { defineCliDep, logCliVersion } from './define-cli-dep';

function installOrUpgradeNpmGlobal(pkg: string, bin: string): void {
  const installer = new NpmGlobalInstaller({
    pkg,
    bin,
    tag: 'latest',
    pathExists: wallOsFs().pathExists,
  });
  if (which(bin)) {
    installer.upgrade();
  } else {
    installer.install();
  }
  logCliVersion(bin, bin);
}

export const wranglerCliDep = defineCliDep({
  id: 'wrangler',
  dependsOn: ['bun', 'node'],
  installOrUpgrade() {
    installOrUpgradeNpmGlobal('wrangler', 'wrangler');
  },
});

export const easCliDep = defineCliDep({
  id: 'eas',
  dependsOn: ['bun', 'node'],
  installOrUpgrade() {
    installOrUpgradeNpmGlobal('eas-cli', 'eas');
  },
});
