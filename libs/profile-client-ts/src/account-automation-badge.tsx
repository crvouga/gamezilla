import { Trans } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { type JSX, Show } from 'solid-js';

/** The "Bot" badge beside a synthetic account's name, drawn from known data. */
export function AccountAutomationBadge(props: {
  readonly profileId: string;
  readonly isBot: boolean;
}): JSX.Element {
  return (
    <Show when={props.isBot}>
      <Badge
        label={<Trans>Bot</Trans>}
        intent="neutral"
        size="sm"
        dataSet={{ testid: `account-automation-${props.profileId}` }}
      />
    </Show>
  );
}
