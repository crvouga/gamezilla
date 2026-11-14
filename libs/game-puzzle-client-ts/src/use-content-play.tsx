import { startPuzzleAttemptMutation } from '@libs/game-puzzle-shared-ts/start-attempt-mutation';
import { useLingui } from '@lingui/solid/macro';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';
import { createSignal } from 'solid-js';
import { useContentGame } from './content-game-context';
import { useContentLibraryState } from './content-library-context';

/** A published puzzle to play, and the pack it is played from. */
export type ContentPlayRequest = {
  readonly revisionId: string;
  readonly packRevisionId: string | null;
  /**
   * Start a new attempt even when one is saved; otherwise the saved
   * attempt at this puzzle is the one that opens.
   */
  readonly fresh?: boolean | undefined;
};

/** A play that could not start: what was asked, and why. */
export type ContentPlayFailure = ContentPlayRequest & {
  readonly message: string;
};

/**
 * Playing a published puzzle in one press: its saved attempt opens on its
 * board, or a new attempt is started and opens. The board appearing is the
 * outcome; a start that is refused stays here with its reason and a retry.
 */
export function useContentPlay() {
  const { t } = useLingui();
  const game = useContentGame();
  const data = useContentLibraryState();
  const mutations = useMutationClient();
  const createId = useCreateId();
  const [starting, setStarting] = createSignal<string | null>(null);
  const [failure, setFailure] = createSignal<ContentPlayFailure | null>(null);
  const saved = (revisionId: string) =>
    data
      .play()
      .attempts.find(
        (attempt) =>
          attempt.mode === 'ordinary' && attempt.source_id === revisionId
      );
  const start = async (request: ContentPlayRequest): Promise<void> => {
    const attemptId = createId();
    setStarting(request.revisionId);
    setFailure(null);
    const refused = t`The puzzle could not be started. Your saved work is kept. Try again.`;
    try {
      const result = await mutations.mutate(
        startPuzzleAttemptMutation(game.catalog),
        {
          revisionId: request.revisionId,
          packRevisionId: request.packRevisionId,
          attemptId,
          positionId: createId(),
        }
      );
      if (result.ok) {
        game.open({ kind: 'attempt', attemptId });
        return;
      }
      setFailure({
        ...request,
        message: result.failures[0]?.message ?? refused,
      });
    } catch (error) {
      setFailure({
        ...request,
        message: error instanceof Error ? error.message : refused,
      });
    } finally {
      setStarting(null);
    }
  };
  const play = (request: ContentPlayRequest): void => {
    if (starting() !== null) return;
    const existing =
      request.fresh === true ? undefined : saved(request.revisionId);
    if (existing !== undefined) {
      game.open({ kind: 'attempt', attemptId: existing.id });
      return;
    }
    void start(request);
  };
  return {
    play,
    /** The puzzle whose attempt is being started, if any. */
    starting,
    failure,
    retry: (): void => {
      const last = failure();
      if (last !== null) void start(last);
    },
    /** The saved attempt at `revisionId`, which Play continues. */
    saved,
  };
}

export type ContentPlay = ReturnType<typeof useContentPlay>;
