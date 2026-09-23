/**
 * Friends' monkey steps: look someone up and add them, answer a request from
 * the inbox, open the list. A signed-in actor's username is their actor id
 * (the simulated Google account's name), so a step can aim at another actor
 * in the walk; a guest or an unknown name simply finds no Add pill.
 */

import { searchUsername } from '@libs/search/sim/search-actions';
import { actorIds } from '@libs/sim-harness/system/observations';
import { visible, walkAction } from '@libs/sim-harness/system/walk-action';
import { Handles } from '@libs/test-ids';

import { openFriendsList } from './friends-actions';

/** Every pill another person's profile can show, whichever state they are in. */
const PERSON_PILLS = [
  Handles.friendAdd,
  Handles.friendCancel,
  Handles.friendConfirm,
  Handles.friendDecline,
  Handles.friendUnblock,
] as const;

function otherActor(ids: readonly string[], self: string, pick: number) {
  const others = ids.filter((id) => id !== self);
  return others[Math.floor(pick * others.length)] ?? null;
}

export const walkRequestFriend = walkAction({
  name: 'walkRequestFriend',
  applies: async (step) =>
    (await visible(step, Handles.tabSearch)) &&
    otherActor(actorIds(step.s), step.actorId, step.pick) !== null,
  act: async ({ s, actorId, ui, pick }) => {
    const other = otherActor(actorIds(s), actorId, pick);
    if (other === null) return;
    await Promise.resolve(searchUsername.act(s, actorId, other));
    if (await ui.get(Handles.friendAdd(other)).isVisible()) {
      await ui.get(Handles.friendAdd(other)).tap();
    }
  },
});

export const walkAcceptFriendRequest = walkAction({
  name: 'walkAcceptFriendRequest',
  applies: (step) => visible(step, Handles.tabNotifications),
  act: async ({ s, ui }) => {
    await ui.get(Handles.tabNotifications).tap();
    await s.session.waitForIdle();
    for (const from of actorIds(s)) {
      const card = Handles.notificationsFriendRequestCard(from);
      if (!(await ui.get(card).isVisible())) continue;
      await ui.get(card).tap();
      const accept = Handles.notificationsFriendRequestAccept(from);
      await ui.get(accept).tap();
      await ui.get(card).expect.hidden();
      return;
    }
  },
});

export const walkOpenFriendsList = walkAction({
  name: 'walkOpenFriendsList',
  applies: async (step) =>
    (await visible(step, Handles.tabProfile)) &&
    !(await visible(step, Handles.spaceClose)),
  act: async ({ s, actorId, ui }) => {
    await ui.get(Handles.tabProfile).tap();
    await s.session.waitForIdle();
    // Guests have no friends list (policy); the stat row is signed-in only.
    if (!(await ui.get(Handles.profileFriendsStats).isVisible())) return;
    await Promise.resolve(openFriendsList.act(s, actorId));
  },
});

/**
 * Look another actor up, open their profile and press whichever pill it
 * shows — send, cancel, confirm, turn down or unblock — so the walk moves a
 * pair through every request state in any order.
 */
export const walkPressPersonPill = walkAction({
  name: 'walkPressPersonPill',
  applies: async (step) =>
    (await visible(step, Handles.tabSearch)) &&
    otherActor(actorIds(step.s), step.actorId, step.pick) !== null,
  act: async ({ s, actorId, ui, pick }) => {
    const other = otherActor(actorIds(s), actorId, pick);
    if (other === null) return;
    await Promise.resolve(searchUsername.act(s, actorId, other));
    const open = Handles.searchUserResultOpen(other);
    // A guest, or someone who blocked this actor, is not in the results.
    if (!(await ui.get(open).isVisible())) return;
    await ui.get(open).tap();
    await ui.get(Handles.friendUserUsername).expect.visible();
    for (const pill of PERSON_PILLS) {
      if (!(await ui.get(pill(other)).isVisible())) continue;
      await ui.get(pill(other)).tap();
      await s.session.waitForIdle();
      break;
    }
    await ui.get(Handles.navBack).tap();
  },
});

export const FRIENDS_WALK_ACTIONS = [
  walkRequestFriend,
  walkPressPersonPill,
  walkAcceptFriendRequest,
  walkOpenFriendsList,
];
