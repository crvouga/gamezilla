import { useSignInModal } from '@libs/auth/public/auth-modals-provider';
import { useIsSignedIn } from '@libs/auth/public/use-current-user';
import { type Href, useRouter } from '@pkgs/ui';

import {
  type FriendsProfileRouteValue,
  friendsProfilePath,
} from './friends-profile-routes';

/** Navigate to a friends route, or open sign-in when the session is guest-only. */
export function useFriendsProfileNavigation() {
  const signedIn = useIsSignedIn();
  const router = useRouter();
  const { open: openSignInModal } = useSignInModal();

  return (route: FriendsProfileRouteValue) => {
    if (!signedIn()) {
      openSignInModal();
      return;
    }
    router.push(friendsProfilePath(route) as Href);
  };
}
