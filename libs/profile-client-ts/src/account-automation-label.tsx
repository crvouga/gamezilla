import type { JSX } from 'solid-js';
import { AccountAutomationBadge } from './account-automation-badge';
import { useProfileColumn } from './use-profile-column';
import { useSyncedProfiles } from './use-synced-profiles';

/**
 * Public, server-controlled account classification; never inferred from a
 * name. It keeps the profile it classifies synced to the device, so someone
 * just met (a new multiplayer opponent) is named and classified at once.
 */
export function AccountAutomationLabel(props: {
  profileId: string;
}): JSX.Element {
  useSyncedProfiles(() => [props.profileId]);
  const kind = useProfileColumn(() => props.profileId, 'accountKind');
  return (
    <AccountAutomationBadge
      profileId={props.profileId}
      isBot={kind() === 'synthetic'}
    />
  );
}
