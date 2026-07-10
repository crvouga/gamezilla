import type {
  WritePolicy,
  WritePolicyRegistry,
} from '@pkgs/sync-engine/server/upload-handler';
import { createWritePolicyRegistry } from '@pkgs/sync-engine/server/upload-handler';

import { CLIENT_CONFIG_TABLE } from '@libs/db/shared/client-config-tables';

export const clientConfigWritePolicy: WritePolicy = () => ({
  allowed: false,
  reason: 'client_config is system-only',
});

export const CLIENT_CONFIG_WRITE_POLICIES: Readonly<Record<string, WritePolicy>> =
  {
    [CLIENT_CONFIG_TABLE.tableName]: clientConfigWritePolicy,
  };

export function createClientConfigWritePolicyRegistry(): WritePolicyRegistry {
  return createWritePolicyRegistry(CLIENT_CONFIG_WRITE_POLICIES);
}
