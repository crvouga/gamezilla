import { Box, LoadingState, SafeAreaView } from '@pkgs/ui';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, type ReactNode } from 'react';

import { DefineBackButton } from './nav/spaces-nav-context';
import { SpaceActiveLayout } from './active-space/space-active-layout';
import {
  SpaceSessionUiProvider,
  type SpaceSessionUiValue,
} from './active-space/space-session-ui-context';

export type SpaceDetailInitialLoadingProps = {
  spaceId: string;
  onOpenDebug?: () => void;
};

/**
 * First-load shell for `/space/:id` — active-space chrome (home + back) with a
 * body spinner only. Avoids swapping to the bare "Spaces" ScreenBase header.
 */
export function SpaceDetailInitialLoading({
  spaceId,
  onOpenDebug,
}: SpaceDetailInitialLoadingProps): ReactNode {
  const router = useRouter();
  const onPressHome = useCallback(() => {
    router.replace('/');
  }, [router]);
  const onPressDebug = useCallback(() => {
    onOpenDebug?.();
  }, [onOpenDebug]);
  const noop = useCallback(() => {}, []);

  const sessionUi = useMemo(
    (): SpaceSessionUiValue => ({
      spaceId,
      onRequestEnd: noop,
      onRequestLeave: noop,
      onRequestRename: noop,
      onPressHome,
      onPressDebug,
    }),
    [spaceId, noop, onPressHome, onPressDebug]
  );

  return (
    <SafeAreaView sx={{ flex: 1, background: 'background' }}>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <SpaceSessionUiProvider value={sessionUi}>
          <DefineBackButton onPress={() => router.back()} />
          <SpaceActiveLayout>
            <LoadingState size="large" />
          </SpaceActiveLayout>
        </SpaceSessionUiProvider>
      </Box>
    </SafeAreaView>
  );
}
