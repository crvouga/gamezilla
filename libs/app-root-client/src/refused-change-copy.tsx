/**
 * What the person is told when a change they made was refused after it had
 * already shown on their device. Keyed by mutation name, a stable wire
 * contract, so the shell needs no sub's code. A change missing here still gets
 * an honest generic line; the server's own message is never shown.
 */

import { useLingui } from '@lingui/solid/macro';

/**
 * The changes told where they live (the space, the lobby, friends, the
 * profile, puzzle settings). Every other refused change is told on
 * Settings › Sync.
 */
export const REFUSED_CHANGES_TOLD_IN_CONTEXT = [
  'renameSpace',
  'endSpace',
  'leaveSpace',
  'createSpace',
  'addSpaceUser',
  'removeSpaceUser',
  'blockUser',
  'unblockUser',
  'removeFriend',
  'cancelFriendRequest',
  'declineFriendRequest',
  'patchAvatar',
  'savePuzzleFeedSettings',
] as const;

export type RefusedChangeToldInContext =
  (typeof REFUSED_CHANGES_TOLD_IN_CONTEXT)[number];

const TOLD_IN_CONTEXT: ReadonlySet<string> = new Set(
  REFUSED_CHANGES_TOLD_IN_CONTEXT
);

/** Whether a refused change is told where it lives rather than on Sync. */
export function isRefusedChangeToldInContext(
  name: string | null
): name is RefusedChangeToldInContext {
  return name !== null && TOLD_IN_CONTEXT.has(name);
}

export type RefusedChangeCopy = {
  /** The headline: which change did not go through. */
  readonly title: (mutationName: string | null, code: string) => string;
  /** The refusal reason and next action, without promising a restored row. */
  readonly detail: (code: string) => string;
};

export function useRefusedChangeCopy(): RefusedChangeCopy {
  const { t } = useLingui();
  const whatWasNotSaved = (name: string): string | undefined => {
    const copy: Readonly<Record<RefusedChangeToldInContext, () => string>> = {
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
    return isRefusedChangeToldInContext(name) ? copy[name]() : undefined;
  };
  return {
    title: (mutationName, code) =>
      code === 'SPACE_NOT_FOUND'
        ? t`That space could not be found`
        : ((mutationName === null
            ? undefined
            : whatWasNotSaved(mutationName)) ?? t`A change wasn't saved`),
    detail: (code) =>
      code === 'SPACE_NOT_FOUND'
        ? t`This request could not be applied. Dismiss this notice and choose another space from the lobby.`
        : code === 'SPACE_TITLE_NOT_ALLOWED'
          ? t`That space name is not allowed. The change was undone.`
          : t`This request was not saved. Check the current details before trying again.`,
  };
}
