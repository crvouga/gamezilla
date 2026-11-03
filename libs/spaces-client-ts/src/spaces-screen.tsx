import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import type { JSX } from 'solid-js';
import { LobbyRefusedChangeNotice } from './space-refused-change-notice';
import { openSpaceDetail } from './space-routes';
import { SpacesScreenView } from './spaces-screen-view';
import { useCreateSpace } from './use-create-space';
import { useSpacesListReady } from './use-spaces-list-ready';
import { useSpacesLobby } from './use-spaces-lobby';

/**
 * Start locally, or show the hosting limit's invitation to Plus.
 */
function useStartSpace(): () => Promise<void> {
  const router = useRouter();
  const createSpace = useCreateSpace();
  const start = async (): Promise<void> => {
    const result = await createSpace();
    if (result.kind === 'limited') return;
    openSpaceDetail(router, result.spaceId);
  };
  return start;
}

/** `/`: wires `SpacesScreenView` to local data, creation and navigation. */
export function SpacesScreen(): JSX.Element {
  const router = useRouter();
  const startSpace = useStartSpace();
  const listReady = useSpacesListReady();
  const lobby = useSpacesLobby();
  return (
    <SpacesScreenView
      status={listReady() ? lobby.status() : 'loading'}
      hostedCount={lobby.hostedCount()}
      spaces={lobby.spaces()}
      notice={<LobbyRefusedChangeNotice />}
      onCreateSpace={startSpace}
      onOpenSpace={(spaceId) => openSpaceDetail(router, spaceId)}
    />
  );
}
