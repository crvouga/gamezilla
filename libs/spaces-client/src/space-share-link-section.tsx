import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client/button';
import { H3 } from '@pkgs/ui-root-client/heading';
import { StackVertical } from '@pkgs/ui-root-client/stack';
import { useMutationButton } from '@pkgs/ui-root-client/use-mutation-button';
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
    <StackVertical gap="sm">
      <H3 size="label">
        <Trans>Link</Trans>
      </H3>
      <Button {...copyButton.buttonProps} />
    </StackVertical>
  );
}
