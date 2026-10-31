import { customGameWinners } from '@libs/game-session-shared-ts/custom-game-outcome';
import type { CustomGame } from '@libs/game-session-shared-ts/custom-game-state';
import { t } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/solid/macro';
import {
  useGamePresentation,
  useTurnGames,
} from '@pkgs/turn-game-client-ts/turn-games-context';
import type { GameResultSummary } from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameWinner } from '@pkgs/turn-game-shared-ts/game-rules';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameActionBar } from '@pkgs/ui-root-client-ts/game-action-bar';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import {
  GameResultHeadline,
  type GameStandingRow,
  GameStandings,
} from '@pkgs/ui-root-client-ts/game-result';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { createMemo, type JSX, Show } from 'solid-js';
import { useSeatNames } from './custom-game-status';
import {
  frameHeadline,
  frameHeadlineText,
  frameStandingRows,
} from './game-frame-headline';
import { customGameRematchReadiness } from './game-frame-rematch-readiness';
import { FrameSeatAvatar } from './game-frame-seats';
import type { CustomGameReview } from './use-custom-game-review';
import type { CustomGameScreenModel } from './use-custom-game-screen';

type ModelProps = { readonly model: CustomGameScreenModel };

const STANDING_AVATAR_SIZE = 32;

/** Who the finished game went to, as the rules name a result; `null` for none. */
export function customGameWinner(game: CustomGame): GameWinner | null {
  if (game.status !== 'completed') return null;
  if (game.outcome === 'draw') return 'draw';
  const winners = customGameWinners(game);
  if (winners.length === 0) return null;
  return winners.length === 1 ? winners[0]! : winners;
}

/** The finished game's standings, from the game's own `frame.result`. */
function useResultSummary(
  model: CustomGameScreenModel
): () => GameResultSummary | null {
  const presentation = useGamePresentation();
  return createMemo(() => {
    const game = model.current();
    const winner = game === null ? null : customGameWinner(game);
    if (game === null || winner === null) return null;
    return presentation(game.fen).frame.result(game.fen, winner);
  });
}

/**
 * Game over, under the final board: the headline (the viewer's own finish
 * when they played, else who won), then every player in finishing order
 * with their score and whether they are ready for a rematch.
 */
export function GameFrameResult(props: ModelProps): JSX.Element {
  const { i18n } = useLingui();
  const summary = useResultSummary(props.model);
  const names = useSeatNames(props.model);
  const readiness = customGameRematchReadiness(props.model.current);
  const rows = createMemo((): readonly GameStandingRow[] =>
    frameStandingRows(
      summary()?.standings ?? [],
      props.model.mySide(),
      (side) => names[side]()
    ).map((row) => ({
      ...row,
      avatar: (
        <FrameSeatAvatar
          model={props.model}
          side={row.id}
          size={STANDING_AVATAR_SIZE}
        />
      ),
      readiness: readiness.of(row.id),
    }))
  );
  return (
    <Show when={summary()}>
      {(result) => (
        <StackVertical gap="md" testId="custom-game-result">
          <GameResultHeadline
            title={frameHeadlineText(
              frameHeadline(result().standings, props.model.mySide()),
              (side) => names[side](),
              i18n().locale
            )}
            caption={readiness.note() ?? undefined}
            dataSet={{ testid: 'custom-game-result-headline' }}
          />
          <GameStandings
            aria-label={t`Standings`}
            scoreLabel={result().scoreLabel}
            rows={rows()}
          />
        </StackVertical>
      )}
    </Show>
  );
}

/** Step back through the finished game from its first position. */
function ReviewAction(
  props: ModelProps & { readonly review: CustomGameReview }
): JSX.Element {
  const rules = useTurnGames();
  const reviewable = (): boolean => {
    const game = props.model.current();
    return (
      game !== null &&
      game.moves.length > 0 &&
      rules.turnsForPosition(game.fen) !== undefined
    );
  };
  return (
    <Show when={reviewable()}>
      <Button
        title={<Trans>Review</Trans>}
        variant="outline"
        intent="neutral"
        onClick={() => props.review.seek(0)}
        dataSet={{ testid: 'custom-game-review-start' }}
      />
    </Show>
  );
}

/**
 * What comes next once the game is over. Someone who played (or may set up
 * the next game) is offered the rematch, a new game with other choices and
 * the review; someone watching goes back to the space or reviews.
 */
export function GameFrameResultActions(
  props: ModelProps & { readonly review: CustomGameReview }
): JSX.Element {
  const plays = (): boolean =>
    props.model.mySide() !== null || props.model.canCreate();
  return (
    <GameActionBar aria-label={t`What next`} items={[]}>
      <Show
        when={plays()}
        fallback={
          <Button
            title={<Trans>Back to the space</Trans>}
            variant="outline"
            intent="neutral"
            onClick={() => props.model.back()}
            dataSet={{ testid: 'custom-game-back' }}
          />
        }
      >
        <Show when={props.model.canCreate()}>
          <GameActionButton
            title={<Trans>Rematch</Trans>}
            variant="solid"
            dataSet={{ testid: 'custom-game-rematch' }}
            operation={() => props.model.choose({ operation: 'rematch' })}
          />
          <GameActionButton
            title={<Trans>Change game</Trans>}
            dataSet={{ testid: 'custom-game-new' }}
            operation={() => props.model.choose({ operation: 'create' })}
          />
        </Show>
      </Show>
      <ReviewAction model={props.model} review={props.review} />
    </GameActionBar>
  );
}
