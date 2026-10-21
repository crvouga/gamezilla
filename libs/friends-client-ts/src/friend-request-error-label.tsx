import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

export function friendRequestErrorLabel(code: string): JSX.Element {
  switch (code) {
    case 'FRIENDS_BLOCKED':
      return (
        <Trans>
          Your friend request could not be shared because the person is
          unavailable.
        </Trans>
      );
    case 'FRIENDS_COOLDOWN':
      return (
        <Trans>
          Try again later. This person recently declined your request.
        </Trans>
      );
    case 'FRIENDS_REQUEST_EXISTS':
      return <Trans>This person already sent you a friend request.</Trans>;
    case 'FRIENDS_ALREADY_FRIENDS':
      return <Trans>You are already friends with this person.</Trans>;
    default:
      return <Trans>Your friend request could not be shared. Try again.</Trans>;
  }
}
