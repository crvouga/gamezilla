import { Trans, useLingui } from '@lingui/solid/macro';
import { Box, Button, Text, useMutationButton } from '@pkgs/ui';
import type { JSX } from 'solid-js';

function spaceShareUrl(spaceId: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/space/${spaceId}`;
  }
  return `/space/${spaceId}`;
}

export function SpaceShareLinkSection(props: {
  readonly spaceId: string;
}): JSX.Element {
  const { t } = useLingui();
  const copyLink = async (): Promise<void> => {
    await navigator.clipboard.writeText(spaceShareUrl(props.spaceId));
  };
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
