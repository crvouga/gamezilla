/** @jsxImportSource solid-js */

import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import type { JSX } from 'solid-js';

/** Set this inbox item aside. It stays in the archived inbox. */
export function InboxArchiveButton(props: {
  readonly testId: string;
  readonly onArchive: () => void;
}): JSX.Element {
  return (
    <Button
      title={<Trans>Archive</Trans>}
      variant="ghost"
      size="sm"
      onClick={() => props.onArchive()}
      dataSet={{ testid: props.testId }}
    />
  );
}
