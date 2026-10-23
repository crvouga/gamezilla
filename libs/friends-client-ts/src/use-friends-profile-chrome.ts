import { useUnlock } from '@libs/permissions-client-ts/unlock';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import type { Href } from '@pkgs/ui-root-shared-ts/href';

import type { FriendsProfileRouteValue } from './friends-profile-routes';
import { friendsProfilePath } from './friends-profile-routes';

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
