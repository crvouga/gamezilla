import { DEVICES_TABLE } from '@libs/db/shared/auth-tables';
import {
  EXTERNAL_ACCOUNTS_TABLE,
  USERS_TABLE,
} from '@libs/db/shared/external-accounts-tables';
import { fail, ok } from '@pkgs/write/shared/write-result';
import {
  createRowWriteBinding,
  defineRowAuthorizeWrite,
  denyAllRowBinding,
  type RowWriteBinding,
} from '@pkgs/write/server/row-write-registry';
import { idMatches } from '@pkgs/write/shared/read-row-values';
import type { RowChange } from '@pkgs/write/shared/row-change';

const deviceRowWrite = defineRowAuthorizeWrite({
  name: 'auth.device.patch',
  authorize: async (ctx, row) => {
    if (ctx.deviceId.length === 0) {
      return fail('AUTH_DEVICE_REQUIRED', 'device writes require x-anon-id');
    }
    return (
      idMatches(row.id, ctx.deviceId, 'AUTH_DEVICE_ID_MISMATCH') ??
      ok(undefined)
    );
  },
});

export const AUTH_ROW_BINDINGS: Readonly<
  Record<string, RowWriteBinding<RowChange>>
> = {
  [DEVICES_TABLE.tableName]: createRowWriteBinding(deviceRowWrite),
  [USERS_TABLE]: denyAllRowBinding('AUTH_SERVER_MANAGED'),
  [EXTERNAL_ACCOUNTS_TABLE]: denyAllRowBinding('AUTH_SERVER_MANAGED'),
};
