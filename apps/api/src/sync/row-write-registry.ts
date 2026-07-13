import { AUTH_ROW_BINDINGS } from '@libs/auth/shared/writes/row-bindings';
import { CHESS_ROW_BINDINGS } from '@libs/chess/shared/writes/row-bindings';
import { CLIENT_CONFIG_ROW_BINDINGS } from '@libs/client-config/shared/writes/row-bindings';
import { FRIENDS_ROW_BINDINGS } from '@libs/friends/shared/row-bindings';
import { PROFILE_ROW_BINDINGS } from '@libs/profile/shared/row-bindings';
import { SPACE_ROW_BINDINGS } from '@libs/spaces/shared/row-bindings';
import { SPACE_INVITE_ROW_BINDINGS } from '@libs/spaces/shared/invite-row-bindings';
import { INBOX_ROW_BINDINGS } from '@pkgs/inbox/shared/writes/row-bindings';
import { createRowWriteRegistry } from '@pkgs/write/server/row-write-registry';
import { ENTITY_STORE_TABLE } from '@libs/db/shared/entity-store-table';

import { createEntityStoreRowBinding } from './entity-store-row-bindings';

export const APP_ROW_WRITE_REGISTRY = createRowWriteRegistry({
  ...AUTH_ROW_BINDINGS,
  ...PROFILE_ROW_BINDINGS,
  ...SPACE_ROW_BINDINGS,
  ...SPACE_INVITE_ROW_BINDINGS,
  ...CHESS_ROW_BINDINGS,
  ...CLIENT_CONFIG_ROW_BINDINGS,
  ...FRIENDS_ROW_BINDINGS,
  ...INBOX_ROW_BINDINGS,
  [ENTITY_STORE_TABLE]: createEntityStoreRowBinding(),
});
