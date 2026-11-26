import { Handles } from '@libs/test-ids-shared-ts/handles';
import { useSetAppFrameHeader } from '@pkgs/ui-root-client-ts/app-frame-chrome';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { SpaceShell } from '@pkgs/ui-root-client-ts/space-shell';
import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
import { SpaceScreenNotice, useSpaceScreenChrome } from './space-screen-chrome';
import { SpaceShellClaimFrame } from './space-shell-claim';

/**
 * The space-level wrapper of every screen in a space: it renders inside the
 * default shell unless it claimed the shell with `ClaimSpaceShell`, in which
 * case it is rendered bare and draws its own template (people row
 * included). See `./space-shell-claim`.
 *
 * The default shell is the space's row 1 and its people row (chrome from
 * `useSpaceScreenChrome`) over a fixed stage: the people in the space stay
 * in view on every screen in it. A screen not yet on a template lays
 * itself out in the room under them and brings its own heading (the
 * space's name is plain text beside back). A game board sizes itself to
 * that room, so the stage never scrolls.
 *
 * While the space is still being reached the stage shows its loading state
 * under the space's own rows, never over the whole screen. The space draws
 * its own top row, so the app's wide header steps aside for it.
 */
export function SpaceScreenFrame(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const chrome = useSpaceScreenChrome();
  useSetAppFrameHeader(false);
  return (
    <SpaceShellClaimFrame
      shell={(content) => (
        <SpaceShell
          spaceName={chrome.spaceName}
          title={chrome.title}
          role={chrome.role}
          onBack={chrome.onBack}
          backLabel={chrome.backLabel}
          onMembers={chrome.onMembers}
          onSettings={chrome.onSettings}
          onMinimize={chrome.onMinimize}
          onLeave={chrome.onLeave}
          onEnd={chrome.onEnd}
          notice={<SpaceScreenNotice />}
          testIds={chrome.testIds}
          nameAs="context"
          stage="fixed"
        >
          {content}
        </SpaceShell>
      )}
    >
      <Show
        when={chrome.status === 'ready'}
        fallback={<LoadingState dataSet={{ testid: Handles.spaceLoading }} />}
      >
        {props.children}
      </Show>
    </SpaceShellClaimFrame>
  );
}
