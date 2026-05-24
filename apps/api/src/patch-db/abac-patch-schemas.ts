/**
 * PatchDB entity schemas for ABAC-only entity types that don't yet have a
 * dedicated feature package (`chat.message`, `friendship`, `friend.request`,
 * `match`). Once any of these graduates to its own `@libs/<feature>`
 * package, move the corresponding schema there.
 */
import { AbacEntityAttr } from '@pkgs/patch-db/abac/abac-entity-attr';
import {
  defineEntitySchema,
  type EntitySchema,
} from '@pkgs/patch-db/schema/entity-schema';
import {
  ChatMessageAttr,
  FriendRequestAttr,
  FriendshipAttr,
  MatchAttr,
} from './abac-patch-attrs';

export const ChatMessageSchema: EntitySchema = defineEntitySchema({
  entityType: 'chat.message',
  attributes: {
    ...ChatMessageAttr,
    owner: AbacEntityAttr.owner,
  },
});

export const FriendshipSchema: EntitySchema = defineEntitySchema({
  entityType: 'friendship',
  attributes: {
    ...FriendshipAttr,
    owner: AbacEntityAttr.owner,
  },
});

export const FriendRequestSchema: EntitySchema = defineEntitySchema({
  entityType: 'friend.request',
  attributes: {
    ...FriendRequestAttr,
    owner: AbacEntityAttr.owner,
  },
});

export const MatchSchema: EntitySchema = defineEntitySchema({
  entityType: 'match',
  attributes: {
    ...MatchAttr,
    owner: AbacEntityAttr.owner,
  },
});

export const ABAC_ONLY_ENTITY_SCHEMAS: readonly EntitySchema[] = [
  ChatMessageSchema,
  FriendshipSchema,
  FriendRequestSchema,
  MatchSchema,
];
