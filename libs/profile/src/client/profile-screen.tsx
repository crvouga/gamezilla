import { MyDisplayName } from './my-display-name';
import { MyProfileAvatar } from './my-profile-avatar';
import {
  Box,
  Button,
  ScreenBase,
  useBreakpoint,
  type ScreenBaseAction,
} from '@pkgs/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';

export type ProfileScreenProps = {
  /** Header overflow actions for user / connection / settings on mobile. */
  readonly accountActions: readonly ScreenBaseAction[];
  /** Desktop centered tab strip (top-level tab navigation). */
  readonly centerTabs?: ReactNode;
  /** Desktop trailing slot (account avatar trigger). */
  readonly headerEnd?: ReactNode;
  /** Leading slot (typically the app logo on root tabs). */
  readonly leading?: ReactNode;
  /** Bottom inset to add to content padding (e.g., for space miniplayer height).
   * Use {@link useSpaceMiniplayerLayoutInsets} from @libs/spaces when
   * rendering inside a space context, or pass 0 otherwise. */
  readonly bottomInset?: number;
};

export function ProfileScreen({
  accountActions,
  centerTabs,
  headerEnd,
  leading,
  bottomInset = 0,
}: ProfileScreenProps) {
  const { t } = useLingui();
  const router = useRouter();
  const isMobile = useBreakpoint() === 'mobile';

  return (
    <ScreenBase
      breadcrumbs={[{ name: <Trans>Profile</Trans> }]}
      actions={isMobile ? [...accountActions] : []}
      centerTabs={centerTabs}
      headerEnd={headerEnd}
      leading={leading}
      content={({ sx }) => (
        <Box
          style={{
            ...sx,
            ...(bottomInset > 0 ? { paddingBottom: bottomInset } : {}),
          }}
        >
          <Box sx={{ alignItems: 'center', gap: 2 }}>
            <MyProfileAvatar size={80} />
            <MyDisplayName variant="title" />
          </Box>
          <Box sx={{ mt: 2, alignSelf: 'stretch' }}>
            <Button
              title={t`Edit profile`}
              onPress={() => router.push('/profile/edit')}
            />
          </Box>
        </Box>
      )}
    />
  );
}
