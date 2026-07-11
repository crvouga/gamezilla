import {
  ENTITY_STORE_NAMESPACE_AUTH,
  ENTITY_STORE_NAMESPACE_STRIPE,
} from '@libs/db/shared/entity-store-table';
import { fail, ok } from '@pkgs/write/shared/write-result';
import {
  createRowWriteBinding,
  defineRowAuthorizeWrite,
  type RowWriteBinding,
} from '@pkgs/write/server/row-write-registry';
import {
  ownerMatches,
  readRowString,
  requireSignedIn,
} from '@pkgs/write/shared/read-row-values';
import type { RowChange } from '@pkgs/write/shared/row-change';
import type { WriteContext } from '@pkgs/write/shared/write-context';

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

function profilePrivateAuthorize(ctx: WriteContext, ownerId: string | undefined) {
  const signedIn = requireSignedIn(ctx, 'PROFILE_PRIVATE_SIGN_IN_REQUIRED');
  if (signedIn !== null) return signedIn;
  return ownerMatches(ownerId, ctx.accountId!, 'PROFILE_PRIVATE_OWNER_MISMATCH') ??
    ok(undefined);
}

function chatMessageAuthorize(
  ctx: WriteContext,
  data: Record<string, unknown> | null
) {
  const signedIn = requireSignedIn(ctx, 'CHAT_MESSAGE_SIGN_IN_REQUIRED');
  if (signedIn !== null) return signedIn;
  const sid = readDataSpaceId(data ?? {});
  if (sid === undefined || !ctx.memberOfSpaceIds.includes(sid)) {
    return fail('CHAT_MESSAGE_SPACE_MEMBERSHIP', 'chat.message space membership required');
  }
  return ok(undefined);
}

type EntityStoreTypeHandler = (
  ctx: WriteContext,
  ownerId: string | undefined,
  data: Record<string, unknown> | null
) => ReturnType<typeof ok<void>> | ReturnType<typeof fail>;

const ENTITY_STORE_TYPE_HANDLERS: Readonly<Record<string, EntityStoreTypeHandler>> =
  {
    'profile.private': (ctx, ownerId) => profilePrivateAuthorize(ctx, ownerId),
    'chat.message': (ctx, _ownerId, data) => chatMessageAuthorize(ctx, data),
    match: (ctx) =>
      requireSignedIn(ctx, 'MATCH_SIGN_IN_REQUIRED') ?? ok(undefined),
    'inventory.item': (ctx) =>
      requireSignedIn(ctx, 'INVENTORY_ITEM_SIGN_IN_REQUIRED') ?? ok(undefined),
    'match.score': () => fail('MATCH_SCORE_SYSTEM_ONLY', 'match.score is system-only'),
    'admin.metric': () => fail('ADMIN_METRIC_SYSTEM_ONLY', 'admin.metric is system-only'),
    'todo-list': () => ok(undefined),
    'todo-list-item': () => ok(undefined),
  };

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

const entityStoreRowWrite = defineRowAuthorizeWrite({
  name: 'entity_store.patch',
  authorize: async (ctx, row) => {
    const namespace = readRowString(row, 'namespace');
    const type = readRowString(row, 'type');

    if (namespace === ENTITY_STORE_NAMESPACE_STRIPE) {
      return fail('STRIPE_ENTITY_STORE_SYSTEM_ONLY', 'stripe entity_store is system-only');
    }
    if (namespace === ENTITY_STORE_NAMESPACE_AUTH) {
      return fail('AUTH_ENTITY_STORE_SERVER_ONLY', 'auth entity_store is server-only');
    }
    if (type !== undefined && STRIPE_ENTITY_TYPES.has(type)) {
      return fail('STRIPE_ENTITY_TYPE_SYSTEM_ONLY', `stripe.${type} is system-only`);
    }
    if (type === undefined || type.length === 0) {
      return fail('ENTITY_STORE_TYPE_REQUIRED', 'entity_store row requires type');
    }

    const parsed = parseEntityStoreRowData(row.values?.['data']);
    if (parsed === 'invalid') {
      return fail('ENTITY_STORE_INVALID_DATA', 'entity_store data must be valid JSON');
    }

    const handler = ENTITY_STORE_TYPE_HANDLERS[type];
    if (handler === undefined) {
      return fail('ENTITY_STORE_TYPE_NOT_WRITABLE', `entity_store type ${type} is not writable`);
    }
    return handler(ctx, readRowString(row, 'owner_id'), parsed);
  },
});

export function createEntityStoreRowBinding(): RowWriteBinding<RowChange> {
  return createRowWriteBinding(entityStoreRowWrite);
}
