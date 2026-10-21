/**
 * Opening a puzzle link: with a connection, and while the puzzle has not
 * been retired, go to the person's own space (opening one when they host
 * none) asking it to put that puzzle on the board. Otherwise say why not.
 */

import { useMyId } from '@libs/auth-client-ts/use-current-user';
import { hasPendingPlay } from '@libs/game-puzzle-shared-ts/derive';
import { LINKED_PUZZLE_PARAM } from '@libs/game-puzzle-shared-ts/puzzle-link';
import { spaceGameHref } from '@libs/spaces-client-ts/space-routes';
import { useCheckConnection } from '@libs/spaces-client-ts/use-check-connection';
import { useCreateSpace } from '@libs/spaces-client-ts/use-create-space';
import type { Decision } from '@pkgs/permissions-shared-ts/decision';
import sql from '@pkgs/sql-root-shared-ts/sql';
import {
  createQuery,
  useSyncEngineInstance,
} from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  untrack,
} from 'solid-js';
import { usePuzzleInteractions } from './puzzle-play-queries';

/** Registered query that hydrates one puzzle by id. */
const PUZZLE_BY_ID_QUERY_NAME = 'chessPuzzleById';

export type PuzzleLinkOpening =
  | { readonly kind: 'opening' }
  | { readonly kind: 'offline' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'spaceLimited'; readonly decision: Decision };

type PuzzleRow = { readonly id: string; readonly deleted_at: unknown };
type SpaceRow = { readonly id: string };

/** The space the person hosts and can play the linked puzzle in. */
function useHostedSpaceId(myId: Accessor<string>): {
  readonly id: Accessor<string | null>;
  readonly ready: Accessor<boolean>;
} {
  const { rows, isLoading } = createQuery(
    () => sql<SpaceRow>`
      SELECT id FROM spaces
      WHERE ended_at IS NULL AND deleted_at IS NULL
        AND (host_account_id = ${myId()} OR host_member_id = ${myId()})
      ORDER BY created_at DESC
      LIMIT 1
    `
  );
  return { id: () => rows()[0]?.id ?? null, ready: () => !isLoading() };
}

/** The person's space, showing the game the puzzle is from, with the puzzle. */
function linkedSpaceHref(
  spaceId: string,
  gameId: string,
  puzzleId: string
): string {
  return spaceGameHref(spaceId, gameId, { [LINKED_PUZZLE_PARAM]: puzzleId });
}

/**
 * Why a puzzle link cannot open its puzzle — no connection, or the puzzle
 * was retired — or null when it can.
 */
function usePuzzleLinkRefusal(
  puzzleId: Accessor<string>
): (
  id: string,
  hold: (handle: { unsubscribe: () => void }) => void
) => Promise<PuzzleLinkOpening | null> {
  const engine = useSyncEngineInstance();
  const checkConnection = useCheckConnection();
  const puzzle = createQuery(
    () => sql<PuzzleRow>`
      SELECT id, deleted_at FROM chess_puzzles WHERE id = ${puzzleId()}
    `
  );
  return async (id, hold) => {
    if (!(await checkConnection())) return { kind: 'offline' };
    const handle = engine.subscribeQueries([
      { name: PUZZLE_BY_ID_QUERY_NAME, params: { id } },
    ]);
    hold(handle);
    const ready = await handle.ready;
    await engine.waitForFirstSync();
    if (!ready) return { kind: 'offline' };
    const row = puzzle.rows()[0];
    return row === undefined || row.deleted_at !== null
      ? { kind: 'unavailable' }
      : null;
  };
}

export function usePuzzleLinkOpening(
  puzzleId: Accessor<string>,
  gameId: string
): Accessor<PuzzleLinkOpening> {
  const myId = useMyId();
  const router = useRouter();
  const refusal = usePuzzleLinkRefusal(puzzleId);
  const createSpace = useCreateSpace();
  const hosted = useHostedSpaceId(myId);
  const attempts = usePuzzleInteractions(puzzleId);
  const [opening, setOpening] = createSignal<PuzzleLinkOpening>({
    kind: 'opening',
  });
  /** The person's own space, opened when they host none. */
  const ownSpace = async (): Promise<string | PuzzleLinkOpening> => {
    const hostedId = hosted.id();
    if (hostedId !== null) return hostedId;
    const created = await createSpace();
    return created.kind === 'limited'
      ? { kind: 'spaceLimited', decision: created.decision }
      : created.spaceId;
  };

  const open = async (
    id: string,
    live: () => boolean,
    hold: (handle: { unsubscribe: () => void }) => void
  ): Promise<void> => {
    setOpening({ kind: 'opening' });
    const spaceOnBoard = untrack(hosted.id);
    // The linked puzzle already being solved is where the link goes, with a
    // connection or without, retired since or not.
    if (spaceOnBoard !== null && hasPendingPlay(untrack(attempts.rows), id)) {
      router.replace(linkedSpaceHref(spaceOnBoard, gameId, id));
      return;
    }
    const refused = await refusal(id, hold);
    if (!live()) return;
    if (refused !== null) {
      setOpening(refused);
      return;
    }
    const space = await ownSpace();
    if (!live()) return;
    if (typeof space === 'string')
      router.replace(linkedSpaceHref(space, gameId, id));
    else setOpening(space);
  };

  // Latched: a later re-query must not open the link a second time.
  const localReady = createMemo<boolean>(
    (was) => was || (hosted.ready() && attempts.ready()),
    false
  );
  createEffect(
    on([puzzleId, localReady], ([id, ready]) => {
      if (id.length === 0) {
        setOpening({ kind: 'unavailable' });
        return;
      }
      if (!ready) return;
      let live = true;
      const held: { unsubscribe: () => void }[] = [];
      onCleanup(() => {
        live = false;
        for (const handle of held) handle.unsubscribe();
      });
      void open(
        id,
        () => live,
        (handle) => held.push(handle)
      );
    })
  );
  return opening;
}
