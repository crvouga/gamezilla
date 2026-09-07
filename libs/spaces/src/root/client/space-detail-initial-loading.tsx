import { Box, useRouter } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { DefineBackButton } from '../../public/nav/spaces-nav-context';
import { closeSpaceDetail } from '../../public/space-routes';
import { SpaceActiveLayout } from './active-space/space-active-layout';
import {
  SpaceSessionUiProvider,
  type SpaceSessionUiValue,
} from './active-space/space-session-ui-context';

export type SpaceDetailInitialLoadingProps = {
  spaceId: string;
};

/**
 * First-load shell for `/space/:id` — active-space chrome (home + back) with an
 * empty body. Avoids swapping to the bare "Spaces" ScreenBase header, and never
 * mounts a full-viewport spinner.
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
    <Box sx={{ flex: 1, background: 'background' }}>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <SpaceSessionUiProvider value={sessionUi}>
          <DefineBackButton onPress={onPressBack} />
          <SpaceActiveLayout>
            <Box sx={{ flex: 1 }} />
          </SpaceActiveLayout>
        </SpaceSessionUiProvider>
      </Box>
    </Box>
  );
}
