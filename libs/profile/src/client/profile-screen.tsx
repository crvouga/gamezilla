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
};

export function ProfileScreen({
  accountActions,
  centerTabs,
  headerEnd,
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
      content={({ sx }) => (
        <Box style={sx}>
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
