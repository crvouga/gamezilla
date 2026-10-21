import { abortMultiplayerMutation } from '@libs/game-matchmaking-shared/abort-multiplayer-mutation';
import { chooseMultiplayerSetupMutation } from '@libs/game-matchmaking-shared/choose-multiplayer-setup-mutation';
import { findNewOpponentMutation } from '@libs/game-matchmaking-shared/find-new-opponent-mutation';
import { findOpponentMutation } from '@libs/game-matchmaking-shared/find-opponent-mutation';
import {
  acceptMultiplayerDrawMutation,
  declineMultiplayerDrawMutation,
  offerMultiplayerDrawMutation,
} from '@libs/game-matchmaking-shared/multiplayer-draw-mutations';
import {
  acceptMultiplayerRematchMutation,
  declineMultiplayerRematchMutation,
  offerMultiplayerRematchMutation,
} from '@libs/game-matchmaking-shared/multiplayer-rematch-mutations';
import { playMultiplayerMoveMutation } from '@libs/game-matchmaking-shared/play-multiplayer-move-mutation';
import { resignMultiplayerMutation } from '@libs/game-matchmaking-shared/resign-multiplayer-mutation';
import { settleMultiplayerClockMutation } from '@libs/game-matchmaking-shared/settle-multiplayer-clock-mutation';
import { stopFindingOpponentMutation } from '@libs/game-matchmaking-shared/stop-finding-opponent-mutation';
import {
  CustomGamesAttr,
  customGameActiveParticipant,
} from '@libs/game-session-shared/custom-game-state';
import {
  useDecision,
  useUnfinishedGamesDecision,
} from '@libs/permissions-client/use-can';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { useSpaceRoomSelector } from '@libs/spaces-client/use-space-room-selector';
import type { Decision } from '@pkgs/permissions-shared/decision';
import { useMutationClient } from '@pkgs/sync-engine-client/mutation-client-context';
import type {
  MutateResult,
  Mutation,
} from '@pkgs/sync-engine-shared/mutations-types';
import { useTurnGames } from '@pkgs/turn-game-client/turn-games-context';
import { useCreateId } from '@pkgs/uuid-client/solid';
import { createSignal } from 'solid-js';
import type { MultiplayerData } from './use-multiplayer-data';

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

export function useMultiplayerControls(data: MultiplayerData) {
  const rules = useTurnGames();
  const client = useMutationClient();
  const createId = useCreateId();
  const beginDecision = useDecision(PERMISSION.matchmakingUse);
  const customGames = useSpaceRoomSelector(CustomGamesAttr.from);
  const unfinishedDecision = useUnfinishedGamesDecision(() => ({
    multiplayer: data.game()?.outcome === 'ongoing' ? 1 : 0,
    customGames: customGameActiveParticipant(customGames(), data.myId())
      ? 1
      : 0,
  }));
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
  const begin = async (timeControl: string) => {
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
      timeControl: matchmaking.clockNamespace + timeControl,
    });
  };
  const stop = () =>
    run(stopFindingOpponentMutation, {
      searchId: data.search()?.search_id ?? 'no-search',
    });
  return {
    ...useMoves(data, run),
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
