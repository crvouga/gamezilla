import { Handles } from '@libs/test-ids-shared-ts/handles';
import { useSetAppFrameHeader } from '@pkgs/ui-root-client-ts/app-frame-chrome';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { SpaceStageTemplate } from '@pkgs/ui-root-client-ts/space-stage-template';
import { type JSX, Show } from 'solid-js';
import { SpaceScreenNotice, useSpaceScreenChrome } from './space-screen-chrome';
import { SpaceShellClaimFrame } from './space-shell-claim';

/**
 * The space-level wrapper of every screen in a space: it renders inside the
 * default stage shell (`SpaceStageTemplate`, scrolling, people as while
 * choosing, chrome from `useSpaceScreenChrome`) unless it claimed the shell
 * with `ClaimSpaceShell`, in which case it is rendered bare and draws its
 * own template. See `./space-shell-claim`.
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
        <SpaceStageTemplate
          {...chrome}
          phase="choosing"
          notice={<SpaceScreenNotice />}
        >
          {content}
        </SpaceStageTemplate>
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
