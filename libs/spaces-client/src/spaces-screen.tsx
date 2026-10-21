import { Handles } from '@libs/test-ids-shared/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useRouter } from '@pkgs/ui-root-client/app-router';
import { CollectionScreen } from '@pkgs/ui-root-client/collection-screen';
import { PlusIcon } from '@pkgs/ui-root-client/icons';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
import type { ScreenBasePrimaryAction } from '@pkgs/ui-root-client/screen-base-types';
import type { JSX } from 'solid-js';
import { createMemo, Show } from 'solid-js';
import { LobbyRefusedChangeNotice } from './space-refused-change-notice';
import { openSpaceDetail } from './space-routes';
import { SpacesLobby } from './spaces-lobby';
import { useCreateSpace } from './use-create-space';
import { useSpacesListReady } from './use-spaces-list-ready';

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

export function SpacesScreen(): JSX.Element {
  const { t } = useLingui();
  const startSpace = useStartSpace();
  const listReady = useSpacesListReady();

  const primaryAction = createMemo((): ScreenBasePrimaryAction => {
    return {
      labels: {
        idle: t`New space`,
        loading: t`Opening…`,
        success: t`Ready`,
        error: t`Couldn't open`,
      },
      operation: startSpace,
      successHoldMs: 0,
      icon: PlusIcon,
      dataSet: { testid: Handles.spaceCreate },
    };
  });

  const onCreateSpace = (): void => {
    void startSpace();
  };

  return (
    <CollectionScreen
      screenId="spaces"
      breadcrumbs={[{ name: <Trans>Spaces</Trans> }]}
      primaryAction={primaryAction()}
      controls={<LobbyRefusedChangeNotice />}
    >
      <Show when={listReady()} fallback={<LoadingState />}>
        <SpacesLobby onCreateSpace={onCreateSpace} />
      </Show>
    </CollectionScreen>
  );
}
