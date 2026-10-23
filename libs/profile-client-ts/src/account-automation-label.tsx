import { Trans } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { type JSX, Show } from 'solid-js';
import { useProfileColumn } from './use-profile-column';

/** Public, server-controlled account classification; never inferred from a name. */
export function AccountAutomationLabel(props: {
  profileId: string;
}): JSX.Element {
  const kind = useProfileColumn(() => props.profileId, 'accountKind');
  return (
    <Show when={kind() === 'synthetic'}>
      <Badge
        label={<Trans>Bot</Trans>}
        intent="neutral"
        size="sm"
        dataSet={{ testid: `account-automation-${props.profileId}` }}
      />
    </Show>
  );
}
