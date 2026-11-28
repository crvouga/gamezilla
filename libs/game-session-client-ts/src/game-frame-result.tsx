import { gameSessionWinners } from '@libs/game-session-shared-ts/game-session-outcome';
import type { GameSession } from '@libs/game-session-shared-ts/game-session-state';
import { t } from '@lingui/core/macro';
import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import { useGamePresentation } from '@pkgs/turn-game-client-ts/turn-games-context';
import type { GameResultSummary } from '@pkgs/turn-game-shared-ts/game-frame';
import type { GamePresentation } from '@pkgs/turn-game-shared-ts/game-presentation';
import type { GameWinner } from '@pkgs/turn-game-shared-ts/game-rules';
import { type Accessor, createMemo } from 'solid-js';
import {
  frameHeadline,
  frameHeadlineText,
  frameStandingRows,
} from './game-frame-headline';
import { gameSessionRematchReadiness } from './game-frame-rematch-readiness';
import type { FrameResult } from './game-frame-view-types';
import { useSeatNames } from './game-session-status';
import { holderOf } from './use-frame-seats';
import type { GameSessionScreenModel } from './use-game-session-screen';

/** Who the finished game went to, as the rules name a result; `null` for none. */
export function gameSessionWinner(game: GameSession): GameWinner | null {
  if (game.status !== 'completed') return null;
  if (game.outcome === 'draw') return 'draw';
  const winners = gameSessionWinners(game);
  if (winners.length === 0) return null;
  return winners.length === 1 ? winners[0]! : winners;
}

/**
 * Why a drawn game was drawn, under its headline ("The game was drawn"):
 * the cause the game records, else the rule its final position shows
 * (`presentation.rulesDrawDescription`), else the game's own rules; `null`
 * for a game that was not drawn.
 */
export function gameSessionDrawReason(
  game: GameSession,
  presentation?: Pick<GamePresentation, 'rulesDrawDescription'>
): string | null {
  if (game.status !== 'completed' || game.outcome !== 'draw') return null;
  if (game.outcomeReason === 'timeout')
    return t`Drawn because a participant ran out of time.`;
  if (game.outcomeReason === 'participant withdrew')
    return t`Drawn because a participant withdrew.`;
  if (game.outcomeReason === 'agreement') return t`Drawn by agreement.`;
  return (
    presentation?.rulesDrawDescription?.(game.fen) ??
    t`Drawn by the game's own rules.`
  );
}

/** The finished game's standings, from the game's own `frame.result`. */
function useResultSummary(
  model: GameSessionScreenModel
): Accessor<GameResultSummary | null> {
  const presentation = useGamePresentation();
  return createMemo(() => {
    const game = model.current();
    const winner = game === null ? null : gameSessionWinner(game);
    if (game === null || winner === null) return null;
    return presentation(game.fen).frame.result(game.fen, winner);
  });
}

/**
 * Game over: the headline (the viewer's own finish when they played, else
 * who won), then every player in finishing order with their score and
 * whether they are ready for a rematch; `null` until a result.
 */
export function useFrameResult(
  model: GameSessionScreenModel
): Accessor<FrameResult | null> {
  const { i18n } = useLingui();
  const presentation = useGamePresentation();
  const summary = useResultSummary(model);
  const names = useSeatNames(model);
  const readiness = gameSessionRematchReadiness(model.current);
  return createMemo(() => {
    const result = summary();
    const game = model.current();
    if (result === null || game === null) return null;
    const nameOf = (side: GameSession['sides'][number]) => names[side]();
    return {
      headline: frameHeadlineText(
        frameHeadline(result.standings, model.mySide()),
        nameOf,
        i18n().locale
      ),
      reason: gameSessionDrawReason(game, presentation(game.fen)),
      // Only someone who may not start the rematch needs telling who does.
      note: model.canCreate() ? null : readiness.note(),
      scoreLabel: result.scoreLabel,
      standings: frameStandingRows(
        result.standings,
        model.mySide(),
        nameOf
      ).map((row) => ({
        ...row,
        holder: holderOf(game[row.id], undefined),
        readiness: readiness.of(row.id),
      })),
    };
  });
}
