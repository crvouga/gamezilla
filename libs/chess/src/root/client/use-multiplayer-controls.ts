import { useMutationClient } from '@libs/auth/public/use-mutation-client';
import { LIMIT, PERMISSION } from '@libs/permissions/public/permission-catalog';
import {
  useDecision,
  useLimitDecision,
} from '@libs/permissions/public/use-can';
import type { Decision } from '@libs/permissions/public/use-permissions';
import type { MutateResult } from '@pkgs/sync-engine/shared';
import { useCreateId } from '@pkgs/uuid/solid';
import { createSignal } from 'solid-js';
import { findChessOpponentMutation } from '../../use-cases/find-opponent/shared/find-opponent-mutation';
import { playMultiplayerMoveMutation } from '../../use-cases/play-multiplayer-move/shared/play-multiplayer-move-mutation';
import { resignMultiplayerMutation } from '../../use-cases/resign-multiplayer/shared/resign-multiplayer-mutation';
import { stopFindingChessOpponentMutation } from '../../use-cases/stop-finding-opponent/shared/stop-finding-opponent-mutation';
import type { useMultiplayerData } from './use-multiplayer-data';

export function useMultiplayerControls(
  data: ReturnType<typeof useMultiplayerData>
) {
  const client = useMutationClient();
  const createId = useCreateId();
  const beginDecision = useDecision(PERMISSION.matchmakingUse);
  const limitDecision = useLimitDecision(
    LIMIT.unfinishedMultiplayerGames,
    () => (data.game()?.outcome === 'ongoing' ? 1 : 0)
  );
  const [denial, setDenial] = createSignal<Decision | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [boardSync, setBoardSync] = createSignal(0);
  const [moving, setMoving] = createSignal(false);
  const accept = (result: MutateResult): void => {
    if (result.ok) {
      setError(null);
      setDenial(null);
      return;
    }
    const failure = result.failures[0];
    const decision = failure?.meta?.['decision'] as Decision | undefined;
    if (decision !== undefined) setDenial(decision);
    else
      setError(
        failure?.message ?? 'Multiplayer chess could not accept that command.'
      );
    throw new Error(
      failure?.message ?? 'Multiplayer chess could not accept that command.'
    );
  };
  const begin = async () => {
    const decision = beginDecision().allowed
      ? limitDecision()
      : beginDecision();
    if (!decision.allowed) {
      setDenial(decision);
      return;
    }
    accept(
      await client.mutate(findChessOpponentMutation, { requestId: createId() })
    );
  };
  const stop = async () =>
    accept(
      await client.mutate(stopFindingChessOpponentMutation, {
        searchId: data.search()?.search_id ?? 'no-search',
        requestId: createId(),
      })
    );
  const resign = async () =>
    accept(
      await client.mutate(resignMultiplayerMutation, {
        gameId: data.game()?.id ?? 'no-game',
        requestId: createId(),
      })
    );
  const play = async (uci: string) => {
    const game = data.game();
    if (game === null || moving()) return;
    setMoving(true);
    try {
      accept(
        await client.mutate(playMultiplayerMoveMutation, {
          gameId: game.id,
          revision: game.revision,
          uci,
          requestId: createId(),
        })
      );
    } catch {
      /* The accepted board and the refusal surface remain on this screen. */
    } finally {
      setMoving(false);
      setBoardSync((n) => n + 1);
    }
  };
  return { begin, stop, resign, play, denial, error, boardSync, moving };
}
