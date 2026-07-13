import {
  denyAllRowBinding,
  type RowWriteBinding,
} from '@pkgs/write/server/row-write-registry';
import type { RowChange } from '@pkgs/write/shared/row-change';

export const INBOX_ROW_BINDINGS: Readonly<
  Record<string, RowWriteBinding<RowChange>>
> = {
  inbox_interactions: denyAllRowBinding('INBOX_SERVER_MANAGED'),
  inbox_preferences: denyAllRowBinding('INBOX_SERVER_MANAGED'),
};
