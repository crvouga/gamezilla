import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import {
  multiplayerOwner,
  multiplayerSideOf,
  multiplayerSides,
} from '@libs/game-matchmaking-shared-ts/multiplayer-roster';
import { frameSwatch } from '@libs/game-session-client-ts/game-frame-look';
import { UserProfileAvatar } from '@libs/profile-client-ts/user-profile-avatar';
import { UserUsername } from '@libs/profile-client-ts/user-username';
import { useGamePresentation } from '@pkgs/turn-game-client-ts/turn-games-context';
import { useGameSideLabel } from '@pkgs/turn-game-client-ts/use-game-side-label';
import {
  GAME_VERSUS_AVATAR_SIZE,
  type GameVersusSide,
} from '@pkgs/ui-root-client-ts/game-stage-overlay';
import type { Accessor, JSX } from 'solid-js';
import type {
  MultiplayerResultShown,
  MultiplayerVersusShown,
} from './multiplayer-overlay-view';
import {
  MultiplayerStatusDetail,
  MultiplayerStatusTitle,
  multiplayerStatusHasDetail,
} from './multiplayer-status';
import { timeControlWords } from './time-control-name';
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
    title: <ResultTitle game={game} myId={myId} />,
    caption: detailed ? <ResultCaption game={game} myId={myId} /> : undefined,
  };
}

/**
 * Who plays whom in the matched game, for its versus card: the person's
 * own side below and the rest above; a watched game is split in two, in
 * seat order. Each side carries its rating and the side it plays.
 */
export function useMultiplayerVersus(
  game: Accessor<MultiplayerGame | null>,
  myId: Accessor<string>
): Accessor<MultiplayerVersusShown | undefined> {
  const presentation = useGamePresentation();
  const sideLabel = useGameSideLabel();
  return () => {
    const current = game();
    if (current === null) return undefined;
    const frame = presentation(current.fen).frame;
    const shown = (
      side: ReturnType<typeof multiplayerSides>[number]
    ): GameVersusSide => {
      const profileId = multiplayerOwner(current, side);
      const rating = current[`${side}_rating`] ?? '';
      const label = sideLabel(current.fen, side);
      return {
        id: side,
        name: <UserUsername profileId={profileId} withAt={false} />,
        avatar: (
          <UserProfileAvatar
            profileId={profileId}
            size={GAME_VERSUS_AVATAR_SIZE}
          />
        ),
        swatch: frameSwatch(frame.seats.look(side)),
        caption: rating === '' ? label : `${label} · ${rating}`,
      };
    };
    const sides = multiplayerSides(current);
    const own = multiplayerSideOf(current, myId());
    const half = Math.ceil(sides.length / 2);
    return {
      others:
        own === null
          ? sides.slice(0, half).map(shown)
          : sides.filter((side) => side !== own).map(shown),
      own: own === null ? sides.slice(half).map(shown) : [shown(own)],
      clock: timeControlWords(current.time_control) || undefined,
    };
  };
}
