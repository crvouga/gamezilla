import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

export function usernameErrorLabel(
  error: { readonly code: string } | null
): JSX.Element {
  if (error === null) {
    return <Trans>Couldn't save</Trans>;
  }
  switch (error.code) {
    case 'USERNAME_TAKEN':
      return <Trans>Username is taken</Trans>;
    case 'USERNAME_COOLDOWN':
      return <Trans>Username was changed recently</Trans>;
    case 'USERNAME_TOO_SHORT':
      return <Trans>Username is too short</Trans>;
    case 'USERNAME_TOO_LONG':
      return <Trans>Username is too long</Trans>;
    case 'USERNAME_INVALID_FORMAT':
      return <Trans>Username can only use letters, numbers, and _</Trans>;
    case 'USERNAME_EMPTY':
      return <Trans>Username is required</Trans>;
    case 'USERNAME_BLOCKED':
      return <Trans>That username is not allowed</Trans>;
    default:
      return <Trans>Couldn't save</Trans>;
  }
}
