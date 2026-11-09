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
  // One handler per person and outcome, so a seat read again (every tick
  // of a game played in real time) still reads the same.
  const opens = new Map<string, () => void>();
  const unlocks = new Map<string, () => void>();
  const once = (
    cache: Map<string, () => void>,
    person: string,
    make: () => () => void
  ): (() => void) => {
    const known = cache.get(person);
    if (known !== undefined) return known;
    const made = make();
    cache.set(person, made);
    return made;
  };
  return (person) => {
    if (person === '' || person === myId()) return undefined;
    const current = decision();
    if (current.allowed)
      return once(
        opens,
        person,
        () => () =>
          router.push({
            pathname: '/profile/user/[userId]',
            params: { userId: person },
          })
      );
    if (unlock.label(current) === undefined) return undefined;
    return once(unlocks, person, () => () => unlock.run(decision()));
  };
}
