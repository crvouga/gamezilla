import { abortMultiplayerMutation } from '@libs/chess-matchmaking-shared/abort-multiplayer-mutation';
import { findNewChessOpponentMutation } from '@libs/chess-matchmaking-shared/find-new-opponent-mutation';
import { findChessOpponentMutation } from '@libs/chess-matchmaking-shared/find-opponent-mutation';
import {
  acceptMultiplayerDrawMutation,
  declineMultiplayerDrawMutation,
  offerMultiplayerDrawMutation,
} from '@libs/chess-matchmaking-shared/multiplayer-draw-mutations';
import {
  acceptMultiplayerRematchMutation,
  declineMultiplayerRematchMutation,
  offerMultiplayerRematchMutation,
} from '@libs/chess-matchmaking-shared/multiplayer-rematch-mutations';
import { playMultiplayerMoveMutation } from '@libs/chess-matchmaking-shared/play-multiplayer-move-mutation';
import { resignMultiplayerMutation } from '@libs/chess-matchmaking-shared/resign-multiplayer-mutation';
import { settleMultiplayerClockMutation } from '@libs/chess-matchmaking-shared/settle-multiplayer-clock-mutation';
import { stopFindingChessOpponentMutation } from '@libs/chess-matchmaking-shared/stop-finding-opponent-mutation';
import {
  useDecision,
  useLimitDecision,
} from '@libs/permissions-client/use-can';
import { LIMIT, PERMISSION } from '@libs/permissions-shared/permission-catalog';
import type { Decision } from '@pkgs/permissions-shared/decision';
import { useMutationClient } from '@pkgs/sync-engine-client/mutation-client-context';
import type {
  MutateResult,
  Mutation,
} from '@pkgs/sync-engine-shared/mutations-types';
import { useCreateId } from '@pkgs/uuid-client/solid';
import { createSignal } from 'solid-js';
import type { MultiplayerData } from './use-multiplayer-data';

const REFUSED = 'Multiplayer chess could not accept that command.';

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
  run: <A>(mutation: Mutation<A>, args: Omit<A, 'requestId'>) => Promise<void>
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
  const client = useMutationClient();
  const createId = useCreateId();
  const beginDecision = useDecision(PERMISSION.matchmakingUse);
  const limitDecision = useLimitDecision(
    LIMIT.unfinishedMultiplayerGames,
    () => (data.game()?.outcome === 'ongoing' ? 1 : 0)
  );
  const refusals = useRefusals();
  const run = async <A>(mutation: Mutation<A>, args: Omit<A, 'requestId'>) =>
    refusals.accept(
      await client.mutate(mutation, { ...args, requestId: createId() } as A)
    );
  const onGame =
    (mutation: Mutation<{ gameId: string; requestId: string }>) => () =>
      run(mutation, { gameId: data.game()?.id ?? 'no-game' });
  const begin = async (timeControl: string) => {
    const decision = beginDecision().allowed
      ? limitDecision()
      : beginDecision();
    if (!decision.allowed) {
      refusals.setDenial(decision);
      return;
    }
    await run(findChessOpponentMutation, { timeControl });
  };
  const stop = () =>
    run(stopFindingChessOpponentMutation, {
      searchId: data.search()?.search_id ?? 'no-search',
    });
  return {
    ...useMoves(data, run),
    begin,
    stop,
    newOpponent: onGame(findNewChessOpponentMutation),
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
      await client.mutate(settleMultiplayerClockMutation, {
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
