import type {
  WritePolicy,
  WritePolicyContext,
  WritePolicyDecision,
} from '@pkgs/sync-engine/server/upload-handler';
import {
  ENTITY_STORE_NAMESPACE_AUTH,
  ENTITY_STORE_NAMESPACE_STRIPE,
} from '@libs/db/shared/entity-store-table';

import {
  allow,
  deny,
  ownerMatches,
  readRowString,
  requireSignedIn,
} from './write-policy-helpers';

const STRIPE_ENTITY_TYPES = new Set<string>([
  'catalog-price',
  'catalog-product',
  'customer',
  'subscription',
  'payment-method',
  'invoice',
  'charge',
  'payment-intent',
  'setup-intent',
  'refund',
  'dispute',
  'checkout-session',
  'webhook-event',
  'webhook-event-cache',
]);

function parseEntityStoreData(raw: unknown): Record<string, unknown> | null {
  if (raw === null || typeof raw !== 'object') return null;
  return raw as Record<string, unknown>;
}

function readDataSpaceId(data: Record<string, unknown>): string | undefined {
  const sid = data['space_id'] ?? data['space-id'];
  return typeof sid === 'string' ? sid : undefined;
}

function profilePrivatePolicy(
  ctx: WritePolicyContext,
  ownerId: string | undefined
): WritePolicyDecision {
  const signedIn = requireSignedIn(ctx.accountId, 'profile.private');
  if (signedIn !== null) return signedIn;
  const ownerCheck = ownerMatches(ownerId, ctx.accountId!);
  if (ownerCheck !== null) return ownerCheck;
  return allow();
}

function chatMessagePolicy(
  ctx: WritePolicyContext,
  data: Record<string, unknown> | null
): WritePolicyDecision {
  const signedIn = requireSignedIn(ctx.accountId, 'chat.message');
  if (signedIn !== null) return signedIn;
  const sid = readDataSpaceId(data ?? {});
  if (sid === undefined || !ctx.memberOfSpaceIds.includes(sid)) {
    return deny('chat.message space membership required');
  }
  return allow();
}

function isFriendshipParticipant(
  data: Record<string, unknown> | null,
  accountId: string
): boolean {
  const from = data?.['from_user_id'] ?? data?.['from-user-id'];
  const to = data?.['to_user_id'] ?? data?.['to-user-id'];
  return (
    (typeof from === 'string' && from === accountId) ||
    (typeof to === 'string' && to === accountId)
  );
}

function friendshipPolicy(
  ctx: WritePolicyContext,
  data: Record<string, unknown> | null
): WritePolicyDecision {
  const signedIn = requireSignedIn(ctx.accountId, 'friendship');
  if (signedIn !== null) return signedIn;
  if (isFriendshipParticipant(data, ctx.accountId!)) {
    return allow();
  }
  return deny('friendship endpoint mismatch');
}

type EntityStoreTypeHandler = (
  ctx: WritePolicyContext,
  ownerId: string | undefined,
  data: Record<string, unknown> | null
) => WritePolicyDecision;

const ENTITY_STORE_TYPE_HANDLERS: Readonly<
  Record<string, EntityStoreTypeHandler>
> = {
  'profile.private': (ctx, ownerId) => profilePrivatePolicy(ctx, ownerId),
  'chat.message': (ctx, _ownerId, data) => chatMessagePolicy(ctx, data),
  friendship: (ctx, _ownerId, data) => friendshipPolicy(ctx, data),
  'friend.request': (ctx) => {
    const signedIn = requireSignedIn(ctx.accountId, 'friend.request');
    return signedIn ?? allow();
  },
  match: (ctx) => requireSignedIn(ctx.accountId, 'match') ?? allow(),
  'inventory.item': (ctx) =>
    requireSignedIn(ctx.accountId, 'inventory.item') ?? allow(),
  'match.score': () => deny('match.score is system-only'),
  'admin.metric': () => deny('admin.metric is system-only'),
  'todo-list': () => allow(),
  'todo-list-item': () => allow(),
};

function entityStoreTypePolicy(
  ctx: WritePolicyContext,
  type: string,
  ownerId: string | undefined,
  data: Record<string, unknown> | null
): WritePolicyDecision {
  const handler = ENTITY_STORE_TYPE_HANDLERS[type];
  if (handler === undefined) {
    return deny(`entity_store type ${type} is not writable`);
  }
  return handler(ctx, ownerId, data);
}

function parseEntityStoreRowData(
  dataRaw: unknown
): Record<string, unknown> | null | 'invalid' {
  if (dataRaw === undefined) return null;
  if (typeof dataRaw === 'string') {
    try {
      return parseEntityStoreData(JSON.parse(dataRaw));
    } catch {
      return 'invalid';
    }
  }
  return parseEntityStoreData(dataRaw);
}

export const entityStoreWritePolicy: WritePolicy = (ctx, row) => {
  const namespace = readRowString(row, 'namespace');
  const type = readRowString(row, 'type');

  if (namespace === ENTITY_STORE_NAMESPACE_STRIPE) {
    return deny('stripe entity_store is system-only');
  }
  if (namespace === ENTITY_STORE_NAMESPACE_AUTH) {
    return deny('auth entity_store is server-only');
  }
  if (type !== undefined && STRIPE_ENTITY_TYPES.has(type)) {
    return deny(`stripe.${type} is system-only`);
  }
  if (type === undefined || type.length === 0) {
    return deny('entity_store row requires type');
  }

  const parsed = parseEntityStoreRowData(row.values?.['data']);
  if (parsed === 'invalid') {
    return deny('entity_store data must be valid JSON');
  }

  return entityStoreTypePolicy(
    ctx,
    type,
    readRowString(row, 'owner_id'),
    parsed
  );
};
