import { abortMultiplayerMutation } from '@libs/game-matchmaking-shared-ts/abort-multiplayer-mutation';
import { chooseMultiplayerSetupMutation } from '@libs/game-matchmaking-shared-ts/choose-multiplayer-setup-mutation';
import { findNewOpponentMutation } from '@libs/game-matchmaking-shared-ts/find-new-opponent-mutation';
import { findOpponentMutation } from '@libs/game-matchmaking-shared-ts/find-opponent-mutation';
import { defaultMatchChoice } from '@libs/game-matchmaking-shared-ts/match-choice';
import {
  acceptMultiplayerDrawMutation,
  declineMultiplayerDrawMutation,
  offerMultiplayerDrawMutation,
} from '@libs/game-matchmaking-shared-ts/multiplayer-draw-mutations';
import {
  acceptMultiplayerRematchMutation,
  declineMultiplayerRematchMutation,
  offerMultiplayerRematchMutation,
} from '@libs/game-matchmaking-shared-ts/multiplayer-rematch-mutations';
import { playMultiplayerMoveMutation } from '@libs/game-matchmaking-shared-ts/play-multiplayer-move-mutation';
import { resignMultiplayerMutation } from '@libs/game-matchmaking-shared-ts/resign-multiplayer-mutation';
import { settleMultiplayerClockMutation } from '@libs/game-matchmaking-shared-ts/settle-multiplayer-clock-mutation';
import { stopFindingOpponentMutation } from '@libs/game-matchmaking-shared-ts/stop-finding-opponent-mutation';
import {
  CustomGamesAttr,
  customGameActiveParticipant,
} from '@libs/game-session-shared-ts/custom-game-state';
import {
  useDecision,
  useUnfinishedGamesDecision,
} from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { unfinishedGamesOffer } from '@libs/permissions-shared-ts/unfinished-games-permission';
import { useSpaceRoomSelector } from '@libs/spaces-client-ts/use-space-room-selector';
import type { Decision } from '@pkgs/permissions-shared-ts/decision';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import type {
  MutateResult,
  Mutation,
} from '@pkgs/sync-engine-shared-ts/mutations-types';
import { useTurnGames } from '@pkgs/turn-game-client-ts/turn-games-context';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';
import { createSignal } from 'solid-js';
import type { MultiplayerData } from './use-multiplayer-data';
import { type UnfinishedGame, useUnfinishedGame } from './use-unfinished-game';

const REFUSED = 'Multiplayer game could not accept that command.';

function useRefusals() {
  const [denial, setDenial] = createSignal<Decision | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const accept = (result: MutateResult): void => {
    if (result.ok) {
      setError(null);
      setDenial(null);
      return;
    }
    const failure = result.failures[0];
    const decision = failure?.meta?.['decision'] as Decision | undefined;
    if (decision !== undefined) setDenial(decision);
    else setError(failure?.message ?? REFUSED);
    throw new Error(failure?.message ?? REFUSED);
  };
  return { denial, setDenial, error, accept };
}

function useMoves(
  data: MultiplayerData,
  run: <A>(
    mutation: Mutation<A>,
    args: Omit<A, 'requestId' | 'spaceId'>
  ) => Promise<void>
) {
  const [boardSync, setBoardSync] = createSignal(0);
  const [moving, setMoving] = createSignal(false);
  const play = async (uci: string) => {
    const game = data.game();
    if (game === null || moving()) return;
    setMoving(true);
    try {
      await run(playMultiplayerMoveMutation, {
        gameId: game.id,
        revision: game.revision,
        uci,
      });
    } catch {
      /* The accepted board and the refusal surface remain on this screen. */
    } finally {
      setMoving(false);
      setBoardSync((n) => n + 1);
    }
  };
  return { play, boardSync, moving };
}

/**
 * The unfinished game limit as this device knows it: what the person holds
 * anywhere, on any device, and what this space shows. Its offer
 * (`unfinished-game-limit.dmn`) is seeking an opponent, or the game to
 * return to in its place.
 */
function useUnfinishedGamesGate(data: MultiplayerData) {
  const customGames = useSpaceRoomSelector(CustomGamesAttr.from);
  const unfinished = useUnfinishedGame();
  const unfinishedDecision = useUnfinishedGamesDecision(() => ({
    multiplayer:
      data.game()?.outcome === 'ongoing' || unfinished()?.kind === 'matched'
        ? 1
        : 0,
    customGames:
      customGameActiveParticipant(customGames(), data.myId()) ||
      unfinished()?.kind === 'custom'
        ? 1
        : 0,
  }));
  return {
    decision: unfinishedDecision,
    /** The game to return to in place of seeking; `null` while they may seek. */
    returnInstead: (): UnfinishedGame | null =>
      unfinishedGamesOffer(unfinishedDecision()) === 'seek an opponent'
        ? null
        : unfinished(),
  };
}

export function useMultiplayerControls(data: MultiplayerData) {
  const rules = useTurnGames();
  const client = useMutationClient();
  const createId = useCreateId();
  const beginDecision = useDecision(PERMISSION.matchmakingUse);
  const unfinished = useUnfinishedGamesGate(data);
  const unfinishedDecision = unfinished.decision;
  const refusals = useRefusals();
  const run = async <A>(
    mutation: Mutation<A>,
    args: Omit<A, 'requestId' | 'spaceId'>
  ) =>
    refusals.accept(
      await client.mutate(mutation, {
        spaceId: data.spaceId() ?? '',
        ...args,
        requestId: createId(),
      } as A)
    );
  const onGame =
    (mutation: Mutation<{ gameId: string; requestId: string }>) => () =>
      run(mutation, { gameId: data.game()?.id ?? 'no-game' });
  const begin = async (timeControl?: string) => {
    const decision = beginDecision().allowed
      ? unfinishedDecision()
      : beginDecision();
    if (!decision.allowed) {
      refusals.setDenial(decision);
      return;
    }
    const matchmaking = rules.capability(data.gameId(), 'matchmaking');
    if (matchmaking === undefined)
      throw new Error('The selected game does not support matchmaking');
    await run(findOpponentMutation, {
      timeControl:
        timeControl === undefined
          ? defaultMatchChoice(matchmaking)
          : matchmaking.namespace + timeControl,
    });
  };
  const stop = () =>
    run(stopFindingOpponentMutation, {
      searchId: data.search()?.search_id ?? 'no-search',
    });
  return {
    ...useMoves(data, run),
    /**
     * The game to return to in place of seeking, when the unfinished game
     * limit (`unfinished-game-limit.dmn`, its offer) keeps the person from
     * seeking; `null` while they may seek.
     */
    returnInstead: unfinished.returnInstead,
    begin,
    stop,
    chooseSetup: (setup: string) =>
      run(chooseMultiplayerSetupMutation, {
        gameId: data.game()?.id ?? 'no-game',
        setup,
      }),
    newOpponent: onGame(findNewOpponentMutation),
    resign: onGame(resignMultiplayerMutation),
    abort: onGame(abortMultiplayerMutation),
    offerDraw: onGame(offerMultiplayerDrawMutation),
    acceptDraw: onGame(acceptMultiplayerDrawMutation),
    declineDraw: onGame(declineMultiplayerDrawMutation),
    offerRematch: onGame(offerMultiplayerRematchMutation),
    acceptRematch: onGame(acceptMultiplayerRematchMutation),
    declineRematch: onGame(declineMultiplayerRematchMutation),
    /** Silent: the server decides whether the deadline really passed. */
    settle: async (gameId: string) => {
      if (!data.participant()) return;
      await client.mutate(settleMultiplayerClockMutation, {
        spaceId: data.spaceId() ?? '',
        gameId,
        requestId: createId(),
      });
    },
    denial: refusals.denial,
    error: refusals.error,
  };
}

export type MultiplayerControlsModel = ReturnType<
  typeof useMultiplayerControls
>;
