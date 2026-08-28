import { wallOsFs } from '@pkgs/os';
import { createSecretBackendCli } from '@pkgs/secret-provider';
import { defineCliDep, logCliVersion } from './define-cli-dep';

export const infisicalCliDep = defineCliDep({
  id: 'infisical',
  dependsOn: ['bun'],
  async installOrUpgrade() {
    const cli = createSecretBackendCli({ osFs: wallOsFs() });
    await cli.installOrUpgrade();
    logCliVersion('infisical', cli.bin, ['--version']);
  },
});
