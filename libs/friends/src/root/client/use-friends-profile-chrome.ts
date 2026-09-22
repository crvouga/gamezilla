import { PERMISSION } from '@libs/permissions/public/permission-catalog';
import { useUnlock } from '@libs/permissions/public/unlock';
import { useDecision } from '@libs/permissions/public/use-can';
import { type Href, useRouter } from '@pkgs/ui';

import {
  type FriendsProfileRouteValue,
  friendsProfilePath,
} from './friends-profile-routes';

/** Navigate to a friends route, or run the denial's unlock when not permitted. */
export function useFriendsProfileNavigation() {
  const decision = useDecision(PERMISSION.friendsUse);
  const unlock = useUnlock();
  const router = useRouter();

  return (route: FriendsProfileRouteValue) => {
    if (!decision().allowed) {
      unlock.run(decision());
      return;
    }
    router.push(friendsProfilePath(route) as Href);
  };
}
