import { gameRecord } from '@libs/game-matchmaking-shared-ts/game-record';
import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useClipboard } from '@pkgs/device-client-ts/solid';
import { useTurnGames } from '@pkgs/turn-game-client-ts/turn-games-context';
import { CopyToClipboardField } from '@pkgs/ui-root-client-ts/copy-to-clipboard-field';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { type JSX, Show } from 'solid-js';
import { useShownName } from './use-shown-name';

/**
 * A game that is over with a result can be kept: its game record, written
 * in the game's notation, and its final position. Each names
 * the two people as the person copying sees them now. An unfinished or
 * aborted game offers neither.
 */
export function MultiplayerGameRecord(props: {
  readonly game: MultiplayerGame;
}): JSX.Element {
  const { t } = useLingui();
  const rules = useTurnGames();
  const clipboard = useClipboard();
  const white = useShownName(() => props.game.white_id);
  const black = useShownName(() => props.game.black_id);
  const red = useShownName(() => props.game.red_id ?? '');
  const blue = useShownName(() => props.game.blue_id ?? '');
  const record = () =>
    gameRecord(
      props.game,
      { white: white(), black: black(), red: red(), blue: blue() },
      rules
    );
  return (
    <Show when={record()}>
      {(text) => (
        <StackVertical gap="md">
          <CopyToClipboardField
            label={<Trans>Game record</Trans>}
            helperText={t`Copy the complete game record.`}
            copiedLabel={t`Game record copied`}
            value={text()}
            copy={(value) => clipboard.writeText(value)}
            dataSet={{ testid: 'multiplayer-game-record' }}
            triggerDataSet={{ testid: 'multiplayer-copy-game-record' }}
          />
          <CopyToClipboardField
            label={<Trans>Final position</Trans>}
            copiedLabel={t`Final position copied`}
            value={props.game.fen}
            copy={(value) => clipboard.writeText(value)}
            dataSet={{ testid: 'multiplayer-final-position' }}
            triggerDataSet={{ testid: 'multiplayer-copy-final-position' }}
          />
        </StackVertical>
      )}
    </Show>
  );
}
