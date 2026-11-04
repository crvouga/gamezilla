/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ArchiveIcon } from '@pkgs/ui-root-client-ts/icons';
import type { JSX } from 'solid-js';

/**
 * Set this inbox item aside. It stays in the archived inbox. A small ghost
 * button with the archive glyph and the word "Archive", at the trailing end
 * of the card's action row: always found in the same place and never
 * mistaken for something else, but quieter than the card's own answers.
 */
export function InboxArchiveButton(props: {
  readonly testId: string;
  readonly onArchive: () => void;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <Button
      title={t`Archive`}
      icon={ArchiveIcon}
      variant="ghost"
      intent="neutral"
      size="sm"
      onClick={() => props.onArchive()}
      dataSet={{ testid: props.testId }}
    />
  );
}
