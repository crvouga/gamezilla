import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameReviewScreen } from '@pkgs/ui-root-client-ts/game-review-screen';
import { GameActions } from '@pkgs/ui-root-client-ts/game-section';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';

export type GameReplayScreenViewProps = {
  /** The position shown: 0 is the start, `moves` the end. */
  readonly ply: number;
  readonly moves: number;
  /** How the game ended, in words. */
  readonly label: string;
  /** The position shown, for automated observers. */
  readonly position: string;
  /** The game's own board, read-only, at `position`. */
  readonly board: JSX.Element;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
};

/**
 * Replaying one finished game from History and stats, presentational: the
 * game's own board (`board`) at a numbered move, stepped back and forth.
 */
export function GameReplayScreenView(
  props: GameReplayScreenViewProps
): JSX.Element {
  return (
    <GameReviewScreen
      screenId="game-history-review"
      title={<Trans>Game replay</Trans>}
      timeline={
        <P
          variant="caption"
          role="status"
          testId="game-history-review-move"
          dataSet={{ 'shown-position': props.position }}
        >
          <Trans>
            Move {props.ply} of {props.moves}. {props.label}
          </Trans>
        </P>
      }
      actions={
        <GameActions>
          <Button
            title={<Trans>Previous move</Trans>}
            disabled={props.ply === 0}
            onClick={() => props.onPrevious()}
          />
          <Button
            title={<Trans>Next move</Trans>}
            disabled={props.ply === props.moves}
            onClick={() => props.onNext()}
          />
        </GameActions>
      }
    >
      {props.board}
    </GameReviewScreen>
  );
}
