/**
 * Opening the multiplayer link: go to the person's own space, creating one
 * when they host none, and ask it to put multiplayer game on screen. A
 * person's own space needs no connection, so neither does this.
 */

import { useMyId } from '@libs/auth-client-ts/use-current-user';
import { LINKED_MULTIPLAYER_PARAM } from '@libs/game-matchmaking-shared-ts/multiplayer-link';
import { spaceGameHref } from '@libs/spaces-client-ts/space-routes';
import { useCreateSpace } from '@libs/spaces-client-ts/use-create-space';
import { useTimers } from '@pkgs/clock-client-ts/solid';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { createQuery } from '@pkgs/sync-engine-client-ts/sync-engine-context';
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
import {
  type MultiplayerLinkOpening,
  type MultiplayerLinkTarget,
  startMultiplayerLinkAttempt,
} from './multiplayer-link-attempt';

type SpaceRow = { readonly id: string };

/** The space the person hosts, where their multiplayer game is played. */
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

export type MultiplayerLinkOpeningState = {
  readonly opening: Accessor<MultiplayerLinkOpening>;
  /** Start over after a failure; reuses a space a late try did create. */
  readonly retry: () => void;
};

export function useMultiplayerLinkOpening(
  gameId: string
): MultiplayerLinkOpeningState {
  const myId = useMyId();
  const router = useRouter();
  const timers = useTimers();
  const createSpace = useCreateSpace();
  const hosted = useHostedSpaceId(myId);
  const [opening, setOpening] = createSignal<MultiplayerLinkOpening>({
    kind: 'opening',
  });
  const [attempt, setAttempt] = createSignal(0);

  const resolveTarget = async (): Promise<MultiplayerLinkTarget> => {
    const hostedId = untrack(hosted.id);
    if (hostedId !== null) return { kind: 'space', spaceId: hostedId };
    const created = await createSpace();
    return created.kind === 'limited'
      ? { kind: 'spaceLimited', decision: created.decision }
      : { kind: 'space', spaceId: created.spaceId };
  };

  // Latched: a later re-query must not open the link a second time.
  const localReady = createMemo<boolean>((was) => was || hosted.ready(), false);
  createEffect(
    on(attempt, () => {
      const current = startMultiplayerLinkAttempt({
        timers,
        resolveTarget,
        openSpace: (spaceId) =>
          router.replace(
            spaceGameHref(spaceId, gameId, { [LINKED_MULTIPLAYER_PARAM]: '1' })
          ),
        settle: setOpening,
      });
      onCleanup(current.cancel);
      createEffect(
        on(localReady, (ready) => {
          if (ready) current.ready();
        })
      );
    })
  );
  return { opening, retry: () => setAttempt((n) => n + 1) };
}
