/**
 * Spaces' monkey steps: host, step out to the lobby, end, open the member
 * list — whichever the actor's screen allows. The random walk interleaves
 * them across actors with the platform's (sign in, partition, restore).
 */

import { visible, walkAction } from '@libs/sim-harness/system/walk-action';
import { Handles } from '@libs/test-ids';

import { createSpace, endSpace, openSpaceMembers } from './space-actions';
import { leaveToLobby } from './space-ui';

export const walkCreateSpace = walkAction({
  name: 'walkCreateSpace',
  applies: async (step) =>
    (await visible(step, Handles.tabSpaces)) &&
    !(await visible(step, Handles.spaceClose)),
  act: ({ s, actorId }) => Promise.resolve(createSpace.act(s, actorId)),
});

export const walkLeaveSpaceToLobby = walkAction({
  name: 'walkLeaveSpaceToLobby',
  applies: (step) => visible(step, Handles.spaceClose),
  act: ({ s, actorId }) => leaveToLobby(s, actorId),
});

export const walkEndSpace = walkAction({
  name: 'walkEndSpace',
  weight: 0.5,
  applies: (step) => visible(step, Handles.spaceEnd),
  act: ({ s, actorId }) => Promise.resolve(endSpace.act(s, actorId)),
});

export const walkOpenSpaceMembers = walkAction({
  name: 'walkOpenSpaceMembers',
  applies: (step) => visible(step, Handles.spaceMembersButton),
  act: ({ s, actorId }) => Promise.resolve(openSpaceMembers.act(s, actorId)),
});

export const SPACES_WALK_ACTIONS = [
  walkCreateSpace,
  walkLeaveSpaceToLobby,
  walkEndSpace,
  walkOpenSpaceMembers,
];
