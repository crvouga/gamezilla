/**
 * What the person is told when a change they made was refused after it had
 * already shown on their device. Keyed by mutation name, a stable wire
 * contract, so the shell needs no sub's code. A change missing here still gets
 * an honest generic line; the server's own message is never shown.
 */

import { useLingui } from '@lingui/solid/macro';

export type RefusedChangeCopy = {
  /** The headline: which change did not go through. */
  readonly title: (mutationName: string | null) => string;
  /** Why, when the reason is one people can act on, then that it was undone. */
  readonly detail: (code: string) => string;
};

export function useRefusedChangeCopy(): RefusedChangeCopy {
  const { t } = useLingui();
  const whatWasNotSaved = (name: string): string | undefined => {
    const copy: Readonly<Record<string, () => string>> = {
      renameSpace: () => t`Your space wasn't renamed`,
      endSpace: () => t`Your space wasn't ended`,
      leaveSpace: () => t`You didn't leave the space`,
      createSpace: () => t`Your new space wasn't created`,
      addSpaceUser: () => t`That person wasn't added to the space`,
      removeSpaceUser: () => t`That person wasn't removed from the space`,
      blockUser: () => t`That person wasn't blocked`,
      unblockUser: () => t`That person wasn't unblocked`,
      removeFriend: () => t`That friend wasn't removed`,
      cancelFriendRequest: () => t`Your friend request wasn't cancelled`,
      declineFriendRequest: () => t`That friend request wasn't declined`,
      patchAvatar: () => t`Your avatar change wasn't saved`,
      savePuzzleFeedSettings: () => t`Your puzzle settings weren't saved`,
    };
    return copy[name]?.();
  };
  return {
    title: (mutationName) =>
      (mutationName === null ? undefined : whatWasNotSaved(mutationName)) ??
      t`A change wasn't saved`,
    detail: (code) =>
      code === 'SPACE_TITLE_NOT_ALLOWED'
        ? t`That space name is not allowed. The change was undone.`
        : t`It could not be saved, so it was undone on this device.`,
  };
}
