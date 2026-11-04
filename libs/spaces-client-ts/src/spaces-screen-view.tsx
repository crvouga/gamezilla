import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { CollectionScreen } from '@pkgs/ui-root-client-ts/collection-screen';
import { PlusIcon } from '@pkgs/ui-root-client-ts/icons';
import type { ScreenBasePrimaryAction } from '@pkgs/ui-root-client-ts/screen-base-types';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import type { SpaceCardData } from './space-card-view';
import type { SpacesLobbyStatus } from './spaces-lobby-view';
import { SpacesLobbyView } from './spaces-lobby-view';

export type SpacesScreenViewProps = {
  /** `loading` until local data and both lobby reads have answered. */
  readonly status: SpacesLobbyStatus;
  /** Live spaces the viewer hosts; shown as "Hosting N spaces" when any. */
  readonly hostedCount: number;
  /** Spaces to show, open-on-this-device first. */
  readonly spaces: readonly SpaceCardData[];
  /** Inline notice for a refused create / end / leave, above the list. */
  readonly notice?: JSX.Element;
  /**
   * Starts a space. The header action shows its progress; a hosting-limit
   * refusal resolves (the invitation opens elsewhere) rather than failing.
   */
  readonly onCreateSpace: () => Promise<void>;
  readonly onOpenSpace: (spaceId: string) => void;
};

/**
 * `/` (the Spaces tab), presentational: the lobby with its loading, empty
 * and populated states and the "New space" action. `SpacesScreen` wires it
 * to local data, space creation and navigation.
 */
export function SpacesScreenView(props: SpacesScreenViewProps): JSX.Element {
  const { t } = useLingui();
  const primaryAction = createMemo(
    (): ScreenBasePrimaryAction => ({
      labels: {
        idle: t`New space`,
        loading: t`Opening…`,
        success: t`Ready`,
        error: t`Couldn't open`,
      },
      operation: () => props.onCreateSpace(),
      successHoldMs: 0,
      icon: PlusIcon,
      dataSet: { testid: Handles.spaceCreate },
    })
  );
  return (
    <CollectionScreen
      screenId="spaces"
      breadcrumbs={[{ name: <Trans>Spaces</Trans> }]}
      primaryAction={primaryAction()}
      controls={props.notice}
    >
      <SpacesLobbyView
        status={props.status}
        hostedCount={props.hostedCount}
        spaces={props.spaces}
        onCreateSpace={() => void props.onCreateSpace()}
        onOpenSpace={props.onOpenSpace}
      />
    </CollectionScreen>
  );
}
