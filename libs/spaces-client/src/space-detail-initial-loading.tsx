import { useRouter } from '@pkgs/ui-root-client/app-router';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
import { Surface } from '@pkgs/ui-root-client/surface';
import type { JSX } from 'solid-js';
import { SpaceActiveLayout } from './space-active-layout';
import { closeSpaceDetail } from './space-routes';
import type { SpaceSessionUiValue } from './space-session-ui-context';
import { SpaceSessionUiProvider } from './space-session-ui-context';
import { DefineBackButton } from './spaces-nav-context';

export type SpaceDetailInitialLoadingProps = {
  spaceId: string;
};

/**
 * First-load shell for `/space/:id` — active-space chrome (home + back) over
 * a loading body. Avoids swapping to the bare "Spaces" ScreenBase header; the
 * spinner sits in the body, under the chrome, never over the whole viewport.
 */
export function SpaceDetailInitialLoading(
  props: SpaceDetailInitialLoadingProps
): JSX.Element {
  const router = useRouter();
  const onPressBack = (): void => {
    closeSpaceDetail(router);
  };
  const noop = (): void => {};

  const sessionUi: SpaceSessionUiValue = {
    get spaceId() {
      return props.spaceId;
    },
    onRequestEnd: noop,
    onRequestLeave: noop,
    onRequestRename: noop,
    get onPressHome() {
      return onPressBack;
    },
  };

  return (
    <Surface tone="background" grow>
      <SpaceSessionUiProvider value={sessionUi}>
        <DefineBackButton onPress={onPressBack} />
        <SpaceActiveLayout hostOffline={false}>
          <LoadingState />
        </SpaceActiveLayout>
      </SpaceSessionUiProvider>
    </Surface>
  );
}
