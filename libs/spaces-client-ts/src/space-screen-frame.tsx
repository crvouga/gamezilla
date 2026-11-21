import { SpaceStageTemplate } from '@pkgs/ui-root-client-ts/space-stage-template';
import type { JSX } from 'solid-js';
import { SpaceScreenNotice, useSpaceScreenChrome } from './space-screen-chrome';
import { SpaceShellClaimFrame } from './space-shell-claim';

/**
 * The space-level wrapper in place of the old chrome: every screen in the
 * space renders inside the default stage shell (`SpaceStageTemplate`,
 * scrolling, people as while choosing, chrome from `useSpaceScreenChrome`)
 * unless it claimed the shell with `ClaimSpaceShell`, in which case it is
 * rendered bare and draws its own template. See `./space-shell-claim`.
 */
export function SpaceScreenFrame(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const chrome = useSpaceScreenChrome();
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
      {props.children}
    </SpaceShellClaimFrame>
  );
}
