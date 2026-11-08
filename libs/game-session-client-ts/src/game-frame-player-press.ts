import { useUnlock } from '@libs/permissions-client-ts/unlock';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';

/**
 * What tapping a player at the table does: opens their profile, where they
 * can be added as a friend. Whether the person may is the decision that
 * gates people's profiles and the friends list (`friends:use`); a denial
 * runs what it unlocks (for a guest, the sign-in prompt) through
 * `useUnlock`, never a branch of its own. A player the press cannot help
 * (a bot, the person themselves, a denial that unlocks nothing) is not
 * pressable: `undefined`.
 */
export function useFramePlayerPress(
  myId: () => string
): (person: string) => (() => void) | undefined {
  const decision = useDecision(PERMISSION.friendsUse);
  const unlock = useUnlock();
  const router = useRouter();
  return (person) => {
    if (person === '' || person === myId()) return undefined;
    const current = decision();
    if (current.allowed)
      return () =>
        router.push({
          pathname: '/profile/user/[userId]',
          params: { userId: person },
        });
    if (unlock.label(current) === undefined) return undefined;
    return () => unlock.run(decision());
  };
}
