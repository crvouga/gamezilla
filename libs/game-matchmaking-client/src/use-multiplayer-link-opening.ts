/**
 * Opening the multiplayer link: go to the person's own space, creating one
 * when they host none, and ask it to put multiplayer game on screen. A
 * person's own space needs no connection, so neither does this.
 */

import { useMyId } from '@libs/auth-client/use-current-user';
import { LINKED_MULTIPLAYER_PARAM } from '@libs/game-matchmaking-shared/multiplayer-link';
import { spaceGameHref } from '@libs/spaces-client/space-routes';
import { useCreateSpace } from '@libs/spaces-client/use-create-space';
import type { Decision } from '@pkgs/permissions-shared/decision';
import sql from '@pkgs/sql-root-shared/sql';
import { createQuery } from '@pkgs/sync-engine-client/sync-engine-context';
import { useRouter } from '@pkgs/ui-root-client/app-router';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  untrack,
} from 'solid-js';

export type MultiplayerLinkOpening =
  | { readonly kind: 'opening' }
  | { readonly kind: 'spaceLimited'; readonly decision: Decision };

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

export function useMultiplayerLinkOpening(
  gameId: string
): Accessor<MultiplayerLinkOpening> {
  const myId = useMyId();
  const router = useRouter();
  const createSpace = useCreateSpace();
  const hosted = useHostedSpaceId(myId);
  const [opening, setOpening] = createSignal<MultiplayerLinkOpening>({
    kind: 'opening',
  });

  const open = async (live: () => boolean): Promise<void> => {
    const hostedId = untrack(hosted.id);
    const created = hostedId === null ? await createSpace() : null;
    if (!live()) return;
    if (created?.kind === 'limited') {
      setOpening({ kind: 'spaceLimited', decision: created.decision });
      return;
    }
    const spaceId = hostedId ?? created?.spaceId;
    if (spaceId === undefined) return;
    router.replace(
      spaceGameHref(spaceId, gameId, { [LINKED_MULTIPLAYER_PARAM]: '1' })
    );
  };

  // Latched: a later re-query must not open the link a second time.
  const localReady = createMemo<boolean>((was) => was || hosted.ready(), false);
  createEffect(
    on(localReady, (ready) => {
      if (!ready) return;
      let live = true;
      onCleanup(() => {
        live = false;
      });
      void open(() => live);
    })
  );
  return opening;
}
