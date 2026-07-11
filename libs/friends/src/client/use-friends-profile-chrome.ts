import { useSignInModal } from '@libs/auth/client/auth-modals-provider';
import { useIsSignedIn } from '@libs/auth/client/use-current-user';
import { useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';

import {
  friendsProfilePath,
  type FriendsProfileRouteValue,
} from './friends-profile-routes';

/** Navigate to a friends route, or open sign-in when the session is guest-only. */
export function useFriendsProfileNavigation() {
  const signedIn = useIsSignedIn();
  const router = useRouter();
  const { open: openSignInModal } = useSignInModal();

  return useCallback(
    (route: FriendsProfileRouteValue) => {
      if (!signedIn) {
        openSignInModal();
        return;
      }
      router.push(friendsProfilePath(route) as Href);
    },
    [openSignInModal, router, signedIn]
  );
}
