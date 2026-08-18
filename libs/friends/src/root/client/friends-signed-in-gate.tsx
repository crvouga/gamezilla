import { useSignInModal } from '@libs/auth/public/auth-modals-provider';
import { useIsSignedIn } from '@libs/auth/public/use-current-user';
import { Trans, useLingui } from '@lingui/react/macro';
import { Box, Button, ScreenBase, Text } from '@pkgs/ui';
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
        <Box
          sx={[
            sx,
            {
              gap: 4,
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <Text variant="body" label={t`Sign in to use friends`} />
          <Button title={t`Sign in`} onPress={openSignInModal} />
        </Box>
      )}
    />
  );
}
