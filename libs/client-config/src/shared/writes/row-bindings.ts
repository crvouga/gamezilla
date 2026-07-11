import { CLIENT_CONFIG_TABLE } from '@libs/db/shared/client-config-tables';
import { denyAllRowBinding, type RowWriteBinding } from '@pkgs/write/server/row-write-registry';
import type { RowChange } from '@pkgs/write/shared/row-change';

export const CLIENT_CONFIG_ROW_BINDINGS: Readonly<
  Record<string, RowWriteBinding<RowChange>>
> = {
  [CLIENT_CONFIG_TABLE.tableName]: denyAllRowBinding('CLIENT_CONFIG_SYSTEM_ONLY'),
};
