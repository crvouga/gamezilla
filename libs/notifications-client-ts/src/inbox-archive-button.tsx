/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import { IconButton } from '@pkgs/ui-root-client-ts/icon-button';
import { ArchiveIcon } from '@pkgs/ui-root-client-ts/icons';
import type { JSX } from 'solid-js';

/** The quiet disc: small beside a card's words, its hit area still 44px. */
const ARCHIVE_DISC_SIZE = 32;
const ARCHIVE_GLYPH_SIZE = 18;

/**
 * Set this inbox item aside. It stays in the archived inbox. A quiet
 * icon-only button with the archive glyph at the card's top trailing
 * corner: always in the same place on every card, named "Archive" for
 * assistive technology and in its hover tooltip, and never louder than the
 * card's own answers.
 */
export function InboxArchiveButton(props: {
  readonly testId: string;
  readonly onArchive: () => void;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <IconButton
      label={t`Archive`}
      size={ARCHIVE_DISC_SIZE}
      tooltipPlacement="bottom-end"
      onClick={() => props.onArchive()}
      dataSet={{ testid: props.testId }}
    >
      <ArchiveIcon size={ARCHIVE_GLYPH_SIZE} color="textSecondary" />
    </IconButton>
  );
}
