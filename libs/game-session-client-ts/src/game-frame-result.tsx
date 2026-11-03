import { customGameWinners } from '@libs/game-session-shared-ts/custom-game-outcome';
import type { CustomGame } from '@libs/game-session-shared-ts/custom-game-state';
import { useLingui } from '@lingui/solid/macro';
import { useGamePresentation } from '@pkgs/turn-game-client-ts/turn-games-context';
import type { GameResultSummary } from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameWinner } from '@pkgs/turn-game-shared-ts/game-rules';
import { type Accessor, createMemo } from 'solid-js';
import { useSeatNames } from './custom-game-status';
import {
  frameHeadline,
  frameHeadlineText,
  frameStandingRows,
} from './game-frame-headline';
import { customGameRematchReadiness } from './game-frame-rematch-readiness';
import type { FrameResult } from './game-frame-view-types';
import type { CustomGameScreenModel } from './use-custom-game-screen';
import { holderOf } from './use-frame-seats';

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
): Accessor<GameResultSummary | null> {
  const presentation = useGamePresentation();
  return createMemo(() => {
    const game = model.current();
    const winner = game === null ? null : customGameWinner(game);
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
  model: CustomGameScreenModel
): Accessor<FrameResult | null> {
  const { i18n } = useLingui();
  const summary = useResultSummary(model);
  const names = useSeatNames(model);
  const readiness = customGameRematchReadiness(model.current);
  return createMemo(() => {
    const result = summary();
    const game = model.current();
    if (result === null || game === null) return null;
    const nameOf = (side: CustomGame['sides'][number]) => names[side]();
    return {
      headline: frameHeadlineText(
        frameHeadline(result.standings, model.mySide()),
        nameOf,
        i18n().locale
      ),
      note: readiness.note(),
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
