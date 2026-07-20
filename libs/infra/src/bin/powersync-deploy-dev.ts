import { LocalPlatform } from '../cli/platform/local';
import { deployPowerSyncSyncConfigOnly } from '../cli/resources/powersync';
import { loadSecretsIntoEnv } from '../cli/secrets/secrets';

const platform = new LocalPlatform();

await loadSecretsIntoEnv();
await deployPowerSyncSyncConfigOnly(platform);
