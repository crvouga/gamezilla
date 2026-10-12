import { gameRecord } from '@libs/chess-matchmaking-shared/game-record';
import type { MultiplayerGame } from '@libs/chess-matchmaking-shared/game-state';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useClipboard } from '@pkgs/device-client/solid';
import { CopyToClipboardField } from '@pkgs/ui-root-client/copy-to-clipboard-field';
import { type JSX, Show } from 'solid-js';
import { useShownName } from './use-shown-name';

/**
 * A game that is over with a result can be kept: its game record, written
 * the way other chess programs read one, and its final position. Each names
 * the two people as the person copying sees them now. An unfinished or
 * aborted game offers neither.
 */
export function MultiplayerGameRecord(props: {
  readonly game: MultiplayerGame;
}): JSX.Element {
  const { t } = useLingui();
  const clipboard = useClipboard();
  const white = useShownName(() => props.game.white_id);
  const black = useShownName(() => props.game.black_id);
  const record = () =>
    gameRecord(props.game, { white: white(), black: black() });
  return (
    <Show when={record()}>
      {(text) => (
        <div class="box gap-3">
          <CopyToClipboardField
            label={<Trans>Game record</Trans>}
            helperText={t`Copy it to open this game in another chess program.`}
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
        </div>
      )}
    </Show>
  );
}
