import { t } from '@lingui/core/macro';
import {
  GameMoveList,
  type GameMoveListEntry,
} from '@pkgs/ui-root-client-ts/game-move-list';
import type { JSX } from '@solidjs/web';
import { createMemo, Show } from 'solid-js';
import type { GameReplayScreenViewProps } from './game-replay-screen-view';

/**
 * Over a phone's board: every move in one line that scrolls sideways, as
 * the stage's own line of moves does, the shown move marked and kept in
 * view, so the moves never take the board's room or push the steps under
 * it. Each move says its game's word in its name (`Move 3 · column 4`).
 */
export function ReplayMoveStrip(props: GameReplayScreenViewProps): JSX.Element {
  const moves = createMemo((): readonly GameMoveListEntry[] =>
    props.moves.map((move, index) => {
      const ply = index + 1;
      const word = props.moveHeading.toLowerCase();
      const named = word === '' ? move.label : `${word} ${move.label}`;
      return {
        ply,
        label: move.label,
        swatch: move.swatch,
        accessibleName:
          move.sideLabel === undefined
            ? t`Move ${ply} · ${named}`
            : t`Move ${ply} · ${named}, ${move.sideLabel}`,
        testId: `game-history-review-move-${String(ply)}`,
      };
    })
  );
  return (
    <Show when={props.moves.length > 0}>
      <GameMoveList
        layout="table"
        aria-label={t`Moves played`}
        perTurn={1}
        current={props.ply}
        moves={moves()}
        onSelect={(ply) => props.onSeek(ply)}
        heading={props.moveHeading || undefined}
        stripKey={t`Moves`}
        ended
        dataSet={{ testid: 'game-history-review-moves' }}
      />
    </Show>
  );
}
