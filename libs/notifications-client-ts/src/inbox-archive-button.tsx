/** @jsxImportSource solid-js */

import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import type { JSX } from 'solid-js';

/**
 * Set this inbox item aside. It stays in the archived inbox. A quiet
 * neutral pill at the end of every card's answers, so it is always found in
 * the same place and never competes with the card's main answer.
 */
export function InboxArchiveButton(props: {
  readonly testId: string;
  readonly onArchive: () => void;
}): JSX.Element {
  return (
    <Button
      title={<Trans>Archive</Trans>}
      variant="ghost"
      intent="neutral"
      size="sm"
      onClick={() => props.onArchive()}
      dataSet={{ testid: props.testId }}
    />
  );
}
