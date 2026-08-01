import { spacesCreateHostAfterRule, spacesHostBeforeRule } from './rules-host';
import { spaceUsersAfterRule, spaceUsersBeforeRule } from './rules-users';

export { SPACE_MESSAGES } from './messages';
export * from './codes';
export { decideSpaceJoinAccess } from './decide-join';
export { isSpaceHostActor } from './host-actor';

export const SPACE_RULES = [
  spacesHostBeforeRule,
  spacesCreateHostAfterRule,
  spaceUsersBeforeRule,
  spaceUsersAfterRule,
] as const;
