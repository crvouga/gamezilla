import { LocalPlatform } from '../cli/platform/local';
import { deployPowerSyncConfig } from '../cli/resources/powersync';
import { loadSecretsIntoEnv } from '../cli/secrets/secrets';

const platform = new LocalPlatform();

loadSecretsIntoEnv();
await deployPowerSyncConfig(platform);
