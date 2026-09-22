import { useLingui } from '@lingui/solid/macro';
import { useSyncEngine } from '@pkgs/sync-engine/solid';
import { AvatarGroup, ISLAND_GAP_STEP, useLayoutMode } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { createEffect, createMemo, createSignal, For, Show } from 'solid-js';
import {
  SPACE_CARD_BORDER_RADIUS,
  SpaceCardGradientBox,
} from '../card/space-card-gradient';
import { useRequestEndSpace } from '../end-space/end-space-modal-provider';
import { useRequestLeaveSpace } from '../leave-space/leave-space-modal-provider';
import { SpaceHostAvatar } from '../members/space-host-avatar';

import { ActiveSpacesSheet } from './active-spaces-sheet';
import { MiniplayerLiveBadge } from './miniplayer-live-badge';
import { SpaceMiniplayerCard } from './space-miniplayer-card';
import {
  type MiniplayerFrame,
  resolveMiniplayerFrame,
  resolveMiniplayerMode,
} from './space-miniplayer-layout';
import { useSpaceMiniplayerVisibleSpaceIds } from './use-space-miniplayer-visible-space-ids';

const AVATAR_SIZE = 40;
const AVATAR_MAX = 3;

/**
 * Bottom-pinned dock: spans the AppFrame column (same width as the header).
 * Wide keeps a small top gap and soft top corners; compact is edge-to-edge
 * above the tab bar.
 */
function MiniplayerFrameBox(props: {
  frame: MiniplayerFrame;
  children: JSX.Element;
}): JSX.Element {
  return (
    <div
      class="box"
      style={{
        width: '100%',
        'align-self': 'stretch',
        'padding-top': props.frame.rounded ? `${ISLAND_GAP_STEP * 4}px` : '0px',
      }}
    >
      {props.children}
    </div>
  );
}

/** Multi-space: one full-bleed tint bar (no deck stack). Opens the picker. */
function MultiSpaceDock(props: {
  spaceIds: readonly string[];
  borderRadius: number;
  onPressOpenPicker: () => void;
}): JSX.Element {
  const { t } = useLingui();
  const count = createMemo(() => props.spaceIds.length);
  const visible = createMemo(() => props.spaceIds.slice(0, AVATAR_MAX));

  return (
    <SpaceCardGradientBox
      class="overflow-hidden flex-row items-center"
      style={{
        width: '100%',
        'min-width': '100%',
        'align-self': 'stretch',
        'border-radius': `${props.borderRadius}px`,
      }}
    >
      <button
        class="clickable clickableTint flex-1 min-w-0 flex-row items-center gap-3 min-h-18 px-3 self-stretch"
        type="button"
        onClick={props.onPressOpenPicker}
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
        <div class="box flex-1 min-w-0">
          <p class="text textBodyBold line-clamp-1 text-on-primary">
            {t`${count()} live spaces`}
          </p>
        </div>
        <MiniplayerLiveBadge />
      </button>
    </SpaceCardGradientBox>
  );
}

export function SpaceMiniplayer(): JSX.Element {
  const { paintReady } = useSyncEngine();
  const spaceIds = useSpaceMiniplayerVisibleSpaceIds();
  const [sheetOpen, setSheetOpen] = createSignal(false);
  const requestEndSpace = useRequestEndSpace();
  const requestLeaveSpace = useRequestLeaveSpace();
  const layout = useLayoutMode();
  const mode = createMemo(() => resolveMiniplayerMode(spaceIds()));
  const frame = createMemo(() => resolveMiniplayerFrame(layout()));
  const borderRadius = createMemo(() =>
    frame().rounded ? SPACE_CARD_BORDER_RADIUS : 0
  );
  const singleSpaceId = createMemo(() => {
    const current = mode();
    return current.mode === 'single' ? current.primarySpaceId : null;
  });

  createEffect(() => {
    if (mode().mode !== 'stack') setSheetOpen(false);
  });

  return (
    <Show when={paintReady() && mode().mode !== 'hidden'}>
      <MiniplayerFrameBox frame={frame()}>
        <Show
          when={singleSpaceId()}
          keyed
          fallback={
            <MultiSpaceDock
              spaceIds={spaceIds()}
              borderRadius={borderRadius()}
              onPressOpenPicker={() => setSheetOpen(true)}
            />
          }
        >
          {(spaceId) => (
            <SpaceMiniplayerCard
              spaceId={spaceId}
              borderRadius={borderRadius()}
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
      </MiniplayerFrameBox>
    </Show>
  );
}
