import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import {
  GameMoveList,
  type GameMoveListEntry,
} from '@pkgs/ui-root-client-ts/game-move-list';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createMemo, type JSX, Show } from 'solid-js';
import type { MultiplayerMovesShown } from './multiplayer-game-view';

type ListProps = {
  readonly moves: MultiplayerMovesShown;
  /** Moves per numbered turn: the game's seats in rotation. */
  readonly perTurn: number;
  /** Shows the position after `ply` moves. */
  readonly onChoose: (ply: number) => void;
};

/**
 * The accepted moves in the game's notation, every move numbered on its own
 * line behind the look of the seat that made it, each one a position to
 * choose and the one on the board marked: the same record a custom game
 * shows.
 */
export function MultiplayerMoveList(props: ListProps): JSX.Element {
  const moves = createMemo((): readonly GameMoveListEntry[] =>
    props.moves.moves.map((move) => ({
      ply: move.ply,
      label: move.san,
      swatch: move.swatch,
      accessibleName: t`Show the position after ${move.name}`,
      testId: `multiplayer-move-${String(move.ply)}`,
    }))
  );
  return (
    <>
      <GameMoveList
        layout="table"
        aria-label={t`Moves played`}
        perTurn={1}
        current={props.moves.shownPly}
        moves={moves()}
        onSelect={props.onChoose}
        heading={props.moves.heading}
        dataSet={{ testid: 'multiplayer-move-list' }}
      />
      <Show when={props.moves.moves.length === 0}>
        <P variant="caption" tone="secondary">
          <Trans>No moves yet.</Trans>
        </P>
      </Show>
    </>
  );
}
