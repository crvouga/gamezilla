import { Trans, useLingui } from '@lingui/react/macro';
import { Box, Button, Text, useMutationButton } from '@pkgs/ui-rn';
import { type ReactNode, useCallback } from 'react';
import { Platform, Share } from 'react-native';

function spaceShareUrl(spaceId: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/space/${spaceId}`;
  }
  return `/space/${spaceId}`;
}

export function SpaceShareLinkSection({
  spaceId,
}: {
  readonly spaceId: string;
}): ReactNode {
  const { t } = useLingui();
  const copyLink = useCallback(async () => {
    const url = spaceShareUrl(spaceId);
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      await navigator.clipboard.writeText(url);
      return;
    }
    await Share.share({ message: url, url });
  }, [spaceId]);
  const copyButton = useMutationButton({
    operation: copyLink,
    labels: {
      idle: t`Copy link`,
      loading: t`Copying…`,
      success: t`Copied`,
      error: t`Couldn't copy`,
    },
  });
  return (
    <Box sx={{ gap: 2 }}>
      <Text variant="label" label={<Trans>Link</Trans>} />
      <Button {...copyButton.buttonProps} />
    </Box>
  );
}
