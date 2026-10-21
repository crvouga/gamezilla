import { useLingui } from '@lingui/solid/macro';
import { useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import { AvatarGroup } from '@pkgs/ui-root-client/avatar-group';
import {
  MiniPlayerBar,
  MiniPlayerDock,
} from '@pkgs/ui-root-client/mini-player';
import { Pressable } from '@pkgs/ui-root-client/pressable';
import { StackVertical } from '@pkgs/ui-root-client/stack';
import { P } from '@pkgs/ui-root-client/text';
import type { JSX } from 'solid-js';
import { createEffect, createMemo, createSignal, For, Show } from 'solid-js';
import { ActiveSpacesSheet } from './active-spaces-sheet';
import { useRequestEndSpace } from './end-space-modal-provider';
import { useRequestLeaveSpace } from './leave-space-modal-provider';
import { MiniplayerLiveBadge } from './miniplayer-live-badge';
import { SpaceHostAvatar } from './space-host-avatar';
import { SpaceMiniplayerCard } from './space-miniplayer-card';
import { resolveMiniplayerMode } from './space-miniplayer-layout';
import { useSpaceMiniplayerVisibleSpaceIds } from './use-space-miniplayer-visible-space-ids';

const AVATAR_SIZE = 40;
const AVATAR_MAX = 3;

/** Multi-space: one full-bleed surface bar (no deck stack). Opens the picker. */
function MultiSpaceDock(props: {
  spaceIds: readonly string[];
  onPressOpenPicker: () => void;
}): JSX.Element {
  const { t } = useLingui();
  const count = createMemo(() => props.spaceIds.length);
  const visible = createMemo(() => props.spaceIds.slice(0, AVATAR_MAX));

  return (
    <MiniPlayerBar>
      <Pressable
        grow
        self="stretch"
        direction="horizontal"
        align="center"
        gap="md"
        paddingX="md"
        onPress={props.onPressOpenPicker}
        aria-label={t`Show your live spaces`}
      >
        <AvatarGroup size={AVATAR_SIZE} maxVisible={AVATAR_MAX} overlap={14}>
          <For each={visible()}>
            {(spaceId) => (
              <SpaceHostAvatar
                spaceId={spaceId}
                size={AVATAR_SIZE}
                vividBackdrop
              />
            )}
          </For>
        </AvatarGroup>
        <StackVertical grow>
          <P variant="bodyBold" lines={1}>
            {t`${count()} live spaces`}
          </P>
        </StackVertical>
        <MiniplayerLiveBadge />
      </Pressable>
    </MiniPlayerBar>
  );
}

/**
 * Bottom-pinned dock: spans the AppFrame column (same width as the header).
 * The dock owns its geometry per layout mode (see `MiniPlayerDock`).
 */
export function SpaceMiniplayer(): JSX.Element {
  const { paintReady } = useSyncEngine();
  const spaceIds = useSpaceMiniplayerVisibleSpaceIds();
  const [sheetOpen, setSheetOpen] = createSignal(false);
  const requestEndSpace = useRequestEndSpace();
  const requestLeaveSpace = useRequestLeaveSpace();
  const mode = createMemo(() => resolveMiniplayerMode(spaceIds()));
  const singleSpaceId = createMemo(() => {
    const current = mode();
    return current.mode === 'single' ? current.primarySpaceId : null;
  });

  createEffect(() => {
    if (mode().mode !== 'stack') setSheetOpen(false);
  });

  return (
    <Show when={paintReady() && mode().mode !== 'hidden'}>
      <MiniPlayerDock>
        <Show
          when={singleSpaceId()}
          keyed
          fallback={
            <MultiSpaceDock
              spaceIds={spaceIds()}
              onPressOpenPicker={() => setSheetOpen(true)}
            />
          }
        >
          {(spaceId) => (
            <SpaceMiniplayerCard
              spaceId={spaceId}
              requestEndSpace={requestEndSpace}
              requestLeaveSpace={requestLeaveSpace}
            />
          )}
        </Show>
        <ActiveSpacesSheet
          spaceIds={spaceIds()}
          visible={sheetOpen()}
          onClose={() => setSheetOpen(false)}
          requestEndSpace={requestEndSpace}
          requestLeaveSpace={requestLeaveSpace}
        />
      </MiniPlayerDock>
    </Show>
  );
}
