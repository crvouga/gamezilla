import { Box, useRouter } from '@pkgs/ui-rn';
import { type ReactNode, useCallback, useContext, useMemo } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { DefineBackButton } from '../../public/nav/spaces-nav-context';
import { closeSpaceDetail } from '../../public/space-routes';
import { SpaceActiveLayout } from './active-space/space-active-layout';
import {
  SpaceSessionUiProvider,
  type SpaceSessionUiValue,
} from './active-space/space-session-ui-context';

const ZERO_SAFE_AREA = { top: 0, right: 0, bottom: 0, left: 0 };

function useSafeAreaBottom(): number {
  return (useContext(SafeAreaInsetsContext) ?? ZERO_SAFE_AREA).bottom;
}

export type SpaceDetailInitialLoadingProps = {
  spaceId: string;
};

/**
 * First-load shell for `/space/:id` — active-space chrome (home + back) with an
 * empty body. Avoids swapping to the bare "Spaces" ScreenBase header, and never
 * mounts a full-viewport spinner.
 */
export function SpaceDetailInitialLoading({
  spaceId,
}: SpaceDetailInitialLoadingProps): ReactNode {
  const router = useRouter();
  const bottomInset = useSafeAreaBottom();
  const onPressHome = useCallback(() => {
    closeSpaceDetail(router);
  }, [router]);
  const onPressBack = useCallback(() => {
    closeSpaceDetail(router);
  }, [router]);
  const noop = useCallback(() => {}, []);

  const sessionUi = useMemo(
    (): SpaceSessionUiValue => ({
      spaceId,
      onRequestEnd: noop,
      onRequestLeave: noop,
      onRequestRename: noop,
      onPressHome,
    }),
    [spaceId, noop, onPressHome]
  );

  return (
    <Box sx={{ flex: 1, background: 'background', paddingBottom: bottomInset }}>
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
