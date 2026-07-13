import {
  SPACE_INVITES_TABLE,
} from '@libs/db/shared/space-tables';
import {
  denyAllRowBinding,
  type RowWriteBinding,
} from '@pkgs/write/server/row-write-registry';
import type { RowChange } from '@pkgs/write/shared/row-change';

/** Space invites are REST-managed; deny all client sync uploads. */
export const SPACE_INVITE_ROW_BINDINGS: Readonly<
  Record<string, RowWriteBinding<RowChange>>
> = {
  [SPACE_INVITES_TABLE.tableName]: denyAllRowBinding(
    'SPACE_INVITES_SERVER_MANAGED'
  ),
};
