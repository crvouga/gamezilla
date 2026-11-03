import type { JSX } from 'solid-js';
import { AccountAutomationBadge } from './account-automation-badge';
import { useProfileColumn } from './use-profile-column';

/** Public, server-controlled account classification; never inferred from a name. */
export function AccountAutomationLabel(props: {
  profileId: string;
}): JSX.Element {
  const kind = useProfileColumn(() => props.profileId, 'accountKind');
  return (
    <AccountAutomationBadge
      profileId={props.profileId}
      isBot={kind() === 'synthetic'}
    />
  );
}
