import { Handles } from '@libs/test-ids-shared/handles';
import { Trans } from '@lingui/solid/macro';
import { Notice } from '@pkgs/ui-root-client/notice';
import type { JSX } from 'solid-js';

/** A guest tried to choose what the space plays. */
export function GameChoiceRefusedNotice(): JSX.Element {
  return (
    <Notice tone="error" dataSet={{ testid: Handles.gameChoiceRefused }}>
      <Trans>Only the host chooses the game.</Trans>
    </Notice>
  );
}
