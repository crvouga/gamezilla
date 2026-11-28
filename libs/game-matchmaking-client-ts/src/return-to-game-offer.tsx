import { findNewOpponentMutation } from '@libs/game-matchmaking-shared-ts/find-new-opponent-mutation';
import { findOpponentMutation } from '@libs/game-matchmaking-shared-ts/find-opponent-mutation';
import { SHARED_MATCHMAKING_SCREEN } from '@libs/game-matchmaking-shared-ts/multiplayer-link';
import { UserProfileAvatar } from '@libs/profile-client-ts/user-profile-avatar';
import { useSpaceRoomSessionId } from '@libs/spaces-client-ts/space-room-context';
import { useGameScreen } from '@libs/spaces-client-ts/use-game-screen';
import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import { useMutationFeedback } from '@pkgs/sync-engine-client-ts/use-mutation-feedback';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { MiniPlayerDock } from '@pkgs/ui-root-client-ts/mini-player';
import {
  ReturnToGame,
  type ReturnToGamePlacement,
} from '@pkgs/ui-root-client-ts/return-to-game';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from '@solidjs/web';
import { type Accessor, createMemo, createSignal, Show } from 'solid-js';
import { useShownName } from './use-shown-name';
import {
  type DailyMatchPreview,
  type UnfinishedGame,
  useUnfinishedGame,
} from './use-unfinished-game';

/** Seeking refused because a game must be finished first. */
const SEEKS: readonly string[] = [
  findOpponentMutation.name,
  findNewOpponentMutation.name,
];
const FINISH_FIRST: readonly string[] = ['limit_reached', 'restricted'];

/** The test id every offer to return to a game carries. */
export const RETURN_TO_GAME = 'return-to-game';

/**
 * The latest seek this device sent was refused for an unfinished game, and
 * the person has not returned to it from here since: told why, wherever
 * they are.
 */
function useRefusedSeek() {
  const seeks = SEEKS.map((name) => useMutationFeedback(name));
  const [heard, setHeard] = createSignal<ReadonlySet<string>>(new Set());
  const refused = createMemo(() =>
    seeks.flatMap((feedback) => {
      const latest = feedback();
      return latest?.status === 'rejected' &&
        latest.code !== null &&
        FINISH_FIRST.includes(latest.code) &&
        !heard().has(latest.mutationId)
        ? [latest.mutationId]
        : [];
    })
  );
  return {
    told: () => refused().length > 0,
    hear: () => setHeard((was) => new Set([...was, ...refused()])),
  };
}

type OfferProps = {
  /** Which game waits. */
  readonly game: UnfinishedGame;
  readonly placement: ReturnToGamePlacement;
  /** Said as what must be finished first, in place of seeking. */
  readonly finishFirst: boolean;
  readonly onReturn: () => void;
};

/** The words of one offer, by the game that waits. Presentational. */
export function ReturnOffer(props: OfferProps): JSX.Element {
  const { t } = useLingui();
  const custom = () => props.game.kind === 'custom';
  const daily = () => (props.game.kind === 'matched' ? props.game.daily : null);
  const title = () => {
    if (props.finishFirst)
      return custom()
        ? t`Finish your game first`
        : t`Finish your matched game first`;
    return custom()
      ? t`Your game is under way`
      : t`Your matched game is waiting for you`;
  };
  return (
    <Show
      when={daily()}
      fallback={
        <ReturnToGame
          title={title()}
          action={
            custom() ? t`Return to your game` : t`Return to your matched game`
          }
          placement={props.placement}
          kind={props.game.kind}
          testId={RETURN_TO_GAME}
          onReturn={props.onReturn}
        />
      }
    >
      {(match) => (
        <DailyReturnCard
          match={match()}
          placement={props.placement}
          finishFirst={props.finishFirst}
          onReturn={props.onReturn}
        />
      )}
    </Show>
  );
}

function DailyReturnCard(
  props: Omit<OfferProps, 'game'> & { match: DailyMatchPreview }
): JSX.Element {
  const { t } = useLingui();
  const name = useShownName(() => props.match.playerId);
  const turn = () =>
    props.match.myTurn ? t`Your move` : t`Waiting for ${name()}`;
  const title = () =>
    props.match.playerId
      ? t`${props.match.game} with ${name()}`
      : props.match.game;
  return (
    <ReturnToGame
      title={title()}
      turn={turn()}
      leading={
        <UserProfileAvatar profileId={props.match.playerId || null} size={48} />
      }
      caption={[
        props.match.figures,
        props.match.lastMove && t`Last move: ${props.match.lastMove}`,
        props.finishFirst && t`Finish your matched game first`,
      ]
        .filter(Boolean)
        .join(' · ')}
      action={t`Return to your matched game`}
      placement={props.placement}
      kind="matched"
      testId={RETURN_TO_GAME}
      onReturn={props.onReturn}
    />
  );
}

/**
 * Go to the unfinished game's board, the refusal heard on the way. From the
 * tabs the board opens over them; from inside a space it takes that space's
 * place, so minimizing once still leads back to the tabs instead of to the
 * space the person returned from.
 */
function useReturn(
  game: Accessor<UnfinishedGame | null>,
  hear: () => void,
  from: 'tabs' | 'space'
): () => void {
  const router = useRouter();
  return () => {
    const target = game();
    if (target === null) return;
    hear();
    if (from === 'space') router.replace(target.href);
    else router.push(target.href);
  };
}

/**
 * Docked above the tab bar, wherever the person is outside a space: the
 * way back to their unfinished game, on every device of theirs.
 */
export function ReturnToGameDock(): JSX.Element {
  const game = useUnfinishedGame();
  const seek = useRefusedSeek();
  const onReturn = useReturn(game, seek.hear, 'tabs');
  return (
    <Show when={game()} keyed>
      {(waiting) => (
        <MiniPlayerDock>
          <ReturnOffer
            game={waiting}
            placement="dock"
            finishFirst={seek.told()}
            onReturn={onReturn}
          />
        </MiniPlayerDock>
      )}
    </Show>
  );
}

/**
 * In a space, over whatever it shows, unless it shows the game's own board:
 * the game session's own space stays on it, and a space showing finding an
 * opponent shows the matched game (or offers it there, in place of
 * seeking). A seek refused for the game is told even on its board.
 */
export function ReturnToGameInSpace(): JSX.Element {
  const game = useUnfinishedGame();
  const seek = useRefusedSeek();
  const onReturn = useReturn(game, seek.hear, 'space');
  const spaceId = useSpaceRoomSessionId();
  const screen = useGameScreen().screen;
  const onItsBoard = (waiting: UnfinishedGame): boolean =>
    waiting.kind === 'custom'
      ? waiting.spaceId === spaceId()
      : screen() === SHARED_MATCHMAKING_SCREEN;
  const shown = createMemo(() => {
    const waiting = game();
    if (waiting === null) return null;
    return seek.told() || !onItsBoard(waiting) ? waiting : null;
  });
  return (
    <Show when={shown()} keyed>
      {(waiting) => (
        <StackVertical
          width="full"
          maxWidth="prose"
          self="center"
          paddingX="lg"
          paddingTop="sm"
        >
          <ReturnOffer
            game={waiting}
            placement="inline"
            finishFirst={seek.told()}
            onReturn={onReturn}
          />
        </StackVertical>
      )}
    </Show>
  );
}

/**
 * Returning to the person's unfinished game from where seeking would be:
 * the refusal it answers is heard on the way.
 */
export function useReturnInsteadOfSeeking(
  game: Accessor<UnfinishedGame | null>
): () => void {
  const seek = useRefusedSeek();
  return useReturn(game, seek.hear, 'space');
}
