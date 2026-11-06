/** @jsxImportSource solid-js */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import { useLingui } from '@lingui/solid/macro';
import { ArchiveIcon, EllipsisIcon } from '@pkgs/ui-root-client-ts/icons';
import { OverflowMenuButton } from '@pkgs/ui-root-client-ts/overflow-menu-button';
import type { JSX } from 'solid-js';

/** The quiet disc: small beside a card's words, its hit area still 44px. */
const MENU_DISC_SIZE = 32;
/** Wide enough for its one row, not a panel. */
const MENU_WIDTH = 200;

/**
 * The card's "…" menu at its top trailing corner, holding Archive (set
 * this inbox item aside; it stays in the archived inbox). One small
 * ellipsis in the same place on every card, so the card's own answers
 * (Join, Decline, Open) are the only controls that call for attention.
 * The menu is named "More" for assistive technology; Archive keeps the
 * card's archive test id.
 */
export function InboxCardMenu(props: {
  /** The card's test id; the trigger and Archive are addressed from it. */
  readonly cardTestId: string;
  readonly onArchive: () => void;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <OverflowMenuButton
      aria-label={t`More`}
      icon={EllipsisIcon}
      size={MENU_DISC_SIZE}
      width={MENU_WIDTH}
      actions={[
        {
          id: 'archive',
          label: t`Archive`,
          icon: ArchiveIcon,
          onClick: () => props.onArchive(),
          dataSet: { testid: Handles.notificationsArchive(props.cardTestId) },
        },
      ]}
      dataSet={{ testid: Handles.notificationsCardMenu(props.cardTestId) }}
    />
  );
}
