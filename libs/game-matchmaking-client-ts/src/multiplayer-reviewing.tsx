import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { HistoryIcon } from '@pkgs/ui-root-client-ts/icons';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Show } from 'solid-js';
import type { OwnBoard } from './use-own-board';

/**
 * Says the board shows an earlier position, and which: it is for reviewing
 * only, and one step returns to the game as it really stands. A listener
 * hears it when it appears and whenever the position changes.
 */
export function MultiplayerReviewing(props: {
  readonly view: OwnBoard;
}): JSX.Element {
  return (
    <Show when={props.view.earlier()}>
      {(earlier) => (
        <Notice
          icon={HistoryIcon}
          dataSet={{ testid: 'multiplayer-reviewing' }}
        >
          <StackVertical align="start" gap="sm">
            <Text variant="inherit" role="status">
              <Show
                when={earlier().move}
                fallback={
                  <Trans>
                    You are reviewing an earlier position, at the start of the
                    game. No piece can be moved on it.
                  </Trans>
                }
              >
                {(move) => (
                  <Trans>
                    You are reviewing an earlier position, after {move().name}.
                    No piece can be moved on it.
                  </Trans>
                )}
              </Show>
            </Text>
            <Button
              title={<Trans>Return to current position</Trans>}
              size="sm"
              variant="outline"
              intent="neutral"
              onClick={props.view.returnToCurrent}
              dataSet={{ testid: 'multiplayer-return-to-current' }}
            />
          </StackVertical>
        </Notice>
      )}
    </Show>
  );
}
