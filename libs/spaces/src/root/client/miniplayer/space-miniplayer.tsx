import { useSyncEngine } from '@pkgs/sync-engine/solid';
import { ISLAND_GAP_STEP, useLayoutMode } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { createEffect, createMemo, createSignal, Show } from 'solid-js';
import { SPACE_CARD_BORDER_RADIUS } from '../card/space-card-gradient';
import { useRequestEndSpace } from '../end-space/end-space-modal-provider';
import { useRequestLeaveSpace } from '../leave-space/leave-space-modal-provider';

import { ActiveSpacesSheet } from './active-spaces-sheet';
import { MiniplayerStackedBar } from './miniplayer-stacked-bar';
import { SpaceMiniplayerCard } from './space-miniplayer-card';
import {
  type MiniplayerFrame,
  resolveMiniplayerFrame,
  resolveMiniplayerMode,
} from './space-miniplayer-layout';
import { useSpaceMiniplayerVisibleSpaceIds } from './use-space-miniplayer-visible-space-ids';

/**
 * Bottom-pinned frame: compact spans the tab-bar width edge to edge; wide
 * centers a card no wider than the lobby cards and keeps island spacing above.
 */
function MiniplayerFrameBox(props: {
  frame: MiniplayerFrame;
  children: JSX.Element;
}): JSX.Element {
  return (
    <Show
      when={props.frame.maxWidth}
      keyed
      fallback={<div class="box">{props.children}</div>}
    >
      {(maxWidth) => (
        <div
          class="box items-center"
          style={{ 'padding-top': `${ISLAND_GAP_STEP * 4}px` }}
        >
          <div class="box w-[100%]" style={{ 'max-width': `${maxWidth}px` }}>
            {props.children}
          </div>
        </div>
      )}
    </Show>
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

  // Sheet is only opened from the stacked bar. Clear it when we leave stack
  // mode (including a brief hidden gap after ending all spaces) so a later
  // single-space remount does not reopen it.
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
            <MiniplayerStackedBar
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
