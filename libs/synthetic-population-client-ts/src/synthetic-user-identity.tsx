import { AccountAutomationBadge } from '@libs/profile-client-ts/account-automation-badge';
import { DeviceAvatar } from '@libs/profile-client-ts/device-avatar';
import { parseAvatarConfig } from '@libs/profile-shared-ts/avatar-config';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { H2 } from '@pkgs/ui-root-client-ts/heading';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { Text } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import type { SyntheticUserDetail } from './synthetic-population-api';
import { AvailabilityBadge, useActivityLabel } from './synthetic-user-labels';

/** The face beside a Synthetic User's name: its persona's avatar. */
export function SyntheticUserAvatar(props: {
  user: Pick<SyntheticUserDetail, 'id' | 'username' | 'persona'>;
  size: number;
}): JSX.Element {
  return (
    <DeviceAvatar
      avatarConfig={parseAvatarConfig(props.user.persona?.avatar ?? null)}
      seedFallback={props.user.id}
      name={props.user.username}
      size={props.size}
    />
  );
}

/**
 * Who a Synthetic User is, at the top of its control panel: its name with
 * the Bot tag every synthetic account carries, then whether it is paused,
 * what it is doing and where, each its own tag.
 */
export function SyntheticUserIdentity(props: {
  user: SyntheticUserDetail;
}): JSX.Element {
  const activity = useActivityLabel();
  return (
    <>
      <StackHorizontal align="center" gap="sm" wrap>
        <H2 size="heading">
          <Text variant="inherit" wrap="break">
            {props.user.username}
          </Text>
        </H2>
        <AccountAutomationBadge
          profileId={props.user.account_id ?? props.user.id}
          isBot
        />
      </StackHorizontal>
      <StackHorizontal gap="xs" wrap>
        <AvailabilityBadge paused={props.user.paused} />
        <Badge
          label={activity(props.user.activity)}
          intent="neutral"
          size="sm"
        />
        <Badge label={props.user.region} intent="neutral" size="sm" />
      </StackHorizontal>
    </>
  );
}
