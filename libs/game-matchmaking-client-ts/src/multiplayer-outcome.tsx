import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import { multiplayerSideOf } from '@libs/game-matchmaking-shared-ts/multiplayer-roster';
import type { JSX } from '@solidjs/web';
import type { MultiplayerResultShown } from './multiplayer-result-card';
import {
  MultiplayerRatingChange,
  MultiplayerStatusDetail,
  MultiplayerStatusTitle,
  multiplayerStatusHasDetail,
} from './multiplayer-status';
import { useMultiplayerViewer } from './use-multiplayer-viewer';

/**
 * How the matched game went for this device's person, from the game alone:
 * won, lost or drawn for someone who played it, `neutral` for a watcher and
 * for a game with no result (aborted, or still played).
 */
export function multiplayerResultTone(
  game: Pick<MultiplayerGame, 'outcome'>,
  ownSide: string | null
): MultiplayerResultShown['tone'] {
  if (ownSide === null) return 'neutral';
  if (game.outcome === 'ongoing' || game.outcome === 'aborted')
    return 'neutral';
  if (game.outcome === 'draw') return 'drawn';
  return game.outcome === ownSide ? 'won' : 'lost';
}

type GameProps = { readonly game: MultiplayerGame; readonly myId: string };

/** The result card's headline, in the words the line under the board uses. */
function ResultTitle(props: GameProps): JSX.Element {
  const { viewer, winnerName } = useMultiplayerViewer(
    () => props.game,
    () => props.myId
  );
  return (
    <MultiplayerStatusTitle
      game={props.game}
      viewer={viewer()}
      winnerName={winnerName()}
      lowOnTime={null}
    />
  );
}

/** Why it ended, a rematch offered to the person and their rating change. */
function ResultCaption(props: GameProps): JSX.Element {
  const { viewer, winnerName } = useMultiplayerViewer(
    () => props.game,
    () => props.myId
  );
  return (
    <MultiplayerStatusDetail
      game={props.game}
      viewer={viewer()}
      winnerName={winnerName()}
      lowOnTime={null}
      withoutRating
    />
  );
}

/** The rating change for the result card's own row. */
function ResultRating(props: GameProps): JSX.Element {
  const { viewer, winnerName } = useMultiplayerViewer(
    () => props.game,
    () => props.myId
  );
  return (
    <MultiplayerRatingChange
      game={props.game}
      viewer={viewer()}
      winnerName={winnerName()}
      lowOnTime={null}
    />
  );
}

/** How `game` ended for this device's person, as the result card shows it. */
export function multiplayerResultShown(
  game: MultiplayerGame,
  myId: string
): MultiplayerResultShown {
  const participant = multiplayerSideOf(game, myId) !== null;
  const detailed = multiplayerStatusHasDetail({
    game,
    viewer: { myId, participant, opponentName: '', opponentRating: '' },
    winnerName: '',
    lowOnTime: null,
  });
  return {
    tone: multiplayerResultTone(game, multiplayerSideOf(game, myId)),
    aborted: game.outcome === 'aborted',
    drawn: game.outcome === 'draw',
    title: <ResultTitle game={game} myId={myId} />,
    caption: detailed ? <ResultCaption game={game} myId={myId} /> : undefined,
    rating: <ResultRating game={game} myId={myId} />,
  };
}
