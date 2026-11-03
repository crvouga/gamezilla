import { type Accessor, createMemo, mapArray } from 'solid-js';
import type { SpaceCardData } from './space-card-view';
import type { SpacesLobbyStatus } from './spaces-lobby-view';
import { useHostedSpaceCount } from './use-hosted-space-count';
import { useJoinableLiveSpaceIds } from './use-joinable-live-space-ids';
import { useOpenSpaceSessionIds } from './use-open-space-session-ids';
import { useSpaceCardData } from './use-space-card-data';

export type SpacesLobbyRead = {
  /** Ready once the hosted count and the list of spaces have both hydrated. */
  readonly status: Accessor<SpacesLobbyStatus>;
  readonly hostedCount: Accessor<number>;
  /** Live spaces, open-on-this-device first; ended spaces drop out. */
  readonly spaces: Accessor<readonly SpaceCardData[]>;
};

function sortCurrentSpacesFirst(
  spaceIds: readonly string[],
  openSet: ReadonlySet<string>
): string[] {
  return [...spaceIds].sort((a, b) => {
    const aOpen = openSet.has(a) ? 0 : 1;
    const bOpen = openSet.has(b) ? 0 : 1;
    return aOpen - bOpen;
  });
}

/** What {@link SpacesLobbyView} shows, read from local data. */
export function useSpacesLobby(): SpacesLobbyRead {
  const hosted = useHostedSpaceCount();
  const joinable = useJoinableLiveSpaceIds();
  const open = useOpenSpaceSessionIds();
  const orderedIds = createMemo(() =>
    sortCurrentSpacesFirst(joinable.spaceIds(), new Set(open.spaceIds()))
  );
  const cards = mapArray(orderedIds, (spaceId) =>
    useSpaceCardData(() => spaceId)
  );
  return {
    status: () =>
      hosted.isLoading() || joinable.isLoading() ? 'loading' : 'ready',
    hostedCount: hosted.count,
    spaces: createMemo(() =>
      cards()
        .map((card) => card())
        .filter((card) => !card.ended)
    ),
  };
}
