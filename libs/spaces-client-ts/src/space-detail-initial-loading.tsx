import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from '@solidjs/web';
import { closeSpaceDetail } from './space-routes';
import { SpaceScreenChromeProvider } from './space-screen-chrome';
import { SpaceScreenFrame } from './space-screen-frame';
import type { SpaceSessionUiValue } from './space-session-ui-context';
import { SpaceSessionUiProvider } from './space-session-ui-context';

export type SpaceDetailInitialLoadingProps = {
  spaceId: string;
};

/**
 * First load of `/space/:id`: the space's own rows over a loading stage, so
 * the screen never swaps through the bare "Spaces" header and the spinner
 * never covers the whole viewport. Back leaves for the spaces list.
 */
export function SpaceDetailInitialLoading(
  props: SpaceDetailInitialLoadingProps
): JSX.Element {
  const router = useRouter();
  const noop = (): void => {};
  const sessionUi: SpaceSessionUiValue = {
    get spaceId() {
      return props.spaceId;
    },
    onRequestEnd: noop,
    onRequestLeave: noop,
    onPressHome: () => closeSpaceDetail(router),
  };

  return (
    <StackVertical grow>
      <SpaceSessionUiProvider value={sessionUi}>
        <SpaceScreenChromeProvider status="loading" hostOffline={false}>
          <SpaceScreenFrame>{null}</SpaceScreenFrame>
        </SpaceScreenChromeProvider>
      </SpaceSessionUiProvider>
    </StackVertical>
  );
}
