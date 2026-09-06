import { useSignInModal } from '@libs/auth/public/auth-modals-provider';
import { useIsSignedIn } from '@libs/auth/public/use-current-user';
import { Trans, useLingui } from '@lingui/react/macro';
import { Box, EmptyState, ScreenBase, UsersIcon } from '@pkgs/ui';
import type { ReactNode } from 'react';

export function FriendsSignedInGate({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const signedIn = useIsSignedIn();
  const { open: openSignInModal } = useSignInModal();
  const { t } = useLingui();

  if (signedIn) return children;

  return (
    <ScreenBase
      screenId="friends-signed-in-gate"
      breadcrumbs={[{ name: <Trans>Friends</Trans> }]}
      content={({ sx }) => (
        <Box sx={sx}>
          <EmptyState
            icon={UsersIcon}
            title={<Trans>Sign in to add friends</Trans>}
            body={
              <Trans>
                Friends let you find each other and jump into shared spaces.
              </Trans>
            }
            action={{ label: t`Sign in`, onPress: openSignInModal }}
          />
        </Box>
      )}
    />
  );
}
