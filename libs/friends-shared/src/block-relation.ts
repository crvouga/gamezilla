import { BlockChanged } from './friends-outbox-messages';
import { opponentRestrictions } from './opponent-restrictions';

/**
 * The published block relation: who among some people has blocked whom, and
 * the delivery that says it may have changed. Other contexts decide with it
 * and never disclose a block.
 */
export const FRIENDS_BLOCK_RELATION = {
  blocks: opponentRestrictions,
  changed: BlockChanged,
} as const;
