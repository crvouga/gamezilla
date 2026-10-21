/** @jsxImportSource solid-js */
/**
 * What the person is told when a change they made was refused after it had
 * already shown on their device. Keyed by mutation name, a stable wire
 * contract, so the shell needs no sub's code. A change missing here still gets
 * an honest generic line; the server's own message is never shown.
 */

import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

type Copy = () => JSX.Element;

const WHAT_WAS_NOT_SAVED: Readonly<Record<string, Copy>> = {
  renameSpace: () => <Trans>Your space wasn't renamed</Trans>,
  endSpace: () => <Trans>Your space wasn't ended</Trans>,
  leaveSpace: () => <Trans>You didn't leave the space</Trans>,
  createSpace: () => <Trans>Your new space wasn't created</Trans>,
  addSpaceUser: () => <Trans>That person wasn't added to the space</Trans>,
  removeSpaceUser: () => (
    <Trans>That person wasn't removed from the space</Trans>
  ),
  blockUser: () => <Trans>That person wasn't blocked</Trans>,
  unblockUser: () => <Trans>That person wasn't unblocked</Trans>,
  removeFriend: () => <Trans>That friend wasn't removed</Trans>,
  cancelFriendRequest: () => (
    <Trans>Your friend request wasn't cancelled</Trans>
  ),
  declineFriendRequest: () => (
    <Trans>That friend request wasn't declined</Trans>
  ),
  patchAvatar: () => <Trans>Your avatar change wasn't saved</Trans>,
  savePuzzleFeedSettings: () => (
    <Trans>Your puzzle settings weren't saved</Trans>
  ),
};

const WHY: Readonly<Record<string, Copy>> = {
  SPACE_TITLE_NOT_ALLOWED: () => <Trans>That space name is not allowed.</Trans>,
};

/** The headline: which change did not go through. */
export function refusedChangeTitle(mutationName: string | null): JSX.Element {
  const copy =
    mutationName === null ? undefined : WHAT_WAS_NOT_SAVED[mutationName];
  return copy === undefined ? <Trans>A change wasn't saved</Trans> : copy();
}

/** Why, when the reason is one people can act on, then that it was undone. */
export function refusedChangeDetail(code: string): JSX.Element {
  const why = WHY[code];
  return why === undefined ? (
    <Trans>It could not be saved, so it was undone on this device.</Trans>
  ) : (
    <>
      {why()} <Trans>The change was undone.</Trans>
    </>
  );
}
