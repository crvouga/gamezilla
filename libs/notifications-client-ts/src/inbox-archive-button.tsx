/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import { IconButton } from '@pkgs/ui-root-client-ts/icon-button';
import { ArchiveIcon } from '@pkgs/ui-root-client-ts/icons';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from 'solid-js';

const ARCHIVE_BUTTON_SIZE = 28;
const ARCHIVE_ICON_SIZE = 16;

/**
 * Set this inbox item aside. It stays in the archived inbox. A small icon
 * button in the outline ink, in the card's trailing corner, named
 * "Archive": always found in the same place (and keeping its full hit
 * area), but the quietest thing on the card, so it never competes with the
 * card's words or answers.
 */
export function InboxArchiveButton(props: {
  readonly testId: string;
  readonly onArchive: () => void;
}): JSX.Element {
  const { t } = useLingui();
  // Its own column, so the button keeps to the top of the card's first
  // line instead of centering on a long title.
  return (
    <StackVertical>
      <IconButton
        label={t`Archive`}
        size={ARCHIVE_BUTTON_SIZE}
        onClick={() => props.onArchive()}
        dataSet={{ testid: props.testId }}
      >
        <ArchiveIcon size={ARCHIVE_ICON_SIZE} color="outline" />
      </IconButton>
    </StackVertical>
  );
}
