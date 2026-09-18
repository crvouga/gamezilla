import { useSignInModal } from '@libs/auth/public/auth-modals-provider';
import { PERMISSION } from '@libs/permissions/public/permission-catalog';
import { useCan } from '@libs/permissions/public/use-can';
import { type Href, useRouter } from '@pkgs/ui';

import {
  type FriendsProfileRouteValue,
  friendsProfilePath,
} from './friends-profile-routes';

/** Navigate to a friends route, or open sign-in when friends are not permitted. */
export function useFriendsProfileNavigation() {
  const canUseFriends = useCan(PERMISSION.friendsUse);
  const router = useRouter();
  const { open: openSignInModal } = useSignInModal();

  return (route: FriendsProfileRouteValue) => {
    if (!canUseFriends()) {
      openSignInModal();
      return;
    }
    router.push(friendsProfilePath(route) as Href);
  };
}
