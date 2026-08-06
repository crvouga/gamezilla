import {
  ENTITY_STORE_NAMESPACE_AUTH,
  ENTITY_STORE_NAMESPACE_STRIPE,
  ENTITY_STORE_TABLE,
} from '@libs/db/shared/entity-store-table';
import type { TablePolicy } from '@pkgs/sync-engine/server/apply-batch';
import type { UploadAuth } from '@pkgs/sync-engine/shared/rules-auth';
import type {
  UploadOp,
  UploadRow,
} from '@pkgs/sync-engine/shared/upload-batch';

import {
  deny,
  ok,
  readRowString,
  type AuthzResult,
} from './table-policy-helpers';

const PUT_PATCH_DELETE = new Set<UploadOp>(['put', 'patch', 'delete']);

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
]);

function parseEntityStoreData(raw: unknown): Record<string, unknown> | null {
  if (raw === null || typeof raw !== 'object') return null;
  return raw as Record<string, unknown>;
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

function readDataSpaceId(data: Record<string, unknown>): string | undefined {
  const sid = data['space_id'] ?? data['space-id'];
  return typeof sid === 'string' ? sid : undefined;
}

function requireSignedIn(auth: UploadAuth, code: string): AuthzResult | null {
  if (
    auth.accountId === null ||
    auth.accountId.length === 0 ||
    auth.isAnon
  ) {
    return deny(code);
  }
  return null;
}

function profilePrivateAuthorize(
  auth: UploadAuth,
  ownerId: string | undefined
): AuthzResult {
  const signedIn = requireSignedIn(auth, 'PROFILE_PRIVATE_SIGN_IN_REQUIRED');
  if (signedIn !== null) return signedIn;
  if (ownerId !== auth.accountId) {
    return deny('PROFILE_PRIVATE_OWNER_MISMATCH');
  }
  return ok();
}

function chatMessageAuthorize(
  auth: UploadAuth,
  data: Record<string, unknown> | null
): AuthzResult {
  const signedIn = requireSignedIn(auth, 'CHAT_MESSAGE_SIGN_IN_REQUIRED');
  if (signedIn !== null) return signedIn;
  const sid = readDataSpaceId(data ?? {});
  if (sid === undefined || !auth.memberOfSpaceIds.includes(sid)) {
    return deny('CHAT_MESSAGE_SPACE_MEMBERSHIP');
  }
  return ok();
}

type TypeHandler = (
  auth: UploadAuth,
  ownerId: string | undefined,
  data: Record<string, unknown> | null
) => AuthzResult;

const ENTITY_STORE_TYPE_HANDLERS: Readonly<Record<string, TypeHandler>> = {
  'profile.private': (auth, ownerId) => profilePrivateAuthorize(auth, ownerId),
  'chat.message': (auth, _ownerId, data) => chatMessageAuthorize(auth, data),
  match: (auth) => requireSignedIn(auth, 'MATCH_SIGN_IN_REQUIRED') ?? ok(),
  'inventory.item': (auth) =>
    requireSignedIn(auth, 'INVENTORY_ITEM_SIGN_IN_REQUIRED') ?? ok(),
  'match.score': () => deny('MATCH_SCORE_SYSTEM_ONLY'),
  'admin.metric': () => deny('ADMIN_METRIC_SYSTEM_ONLY'),
  'todo-list': () => ok(),
  'todo-list-item': () => ok(),
};

function authorizeNamespaceAndType(
  namespace: string | undefined,
  type: string | undefined
): AuthzResult | null {
  if (namespace === ENTITY_STORE_NAMESPACE_STRIPE) {
    return deny('STRIPE_ENTITY_STORE_SYSTEM_ONLY');
  }
  if (namespace === ENTITY_STORE_NAMESPACE_AUTH) {
    return deny('AUTH_ENTITY_STORE_SERVER_ONLY');
  }
  if (type !== undefined && STRIPE_ENTITY_TYPES.has(type)) {
    return deny('STRIPE_ENTITY_TYPE_SYSTEM_ONLY');
  }
  if (type === undefined || type.length === 0) {
    return deny('ENTITY_STORE_TYPE_REQUIRED');
  }
  return null;
}

async function authorizeEntityStore(
  auth: UploadAuth,
  row: UploadRow
): Promise<AuthzResult> {
  const namespace = readRowString(row, 'namespace');
  const type = readRowString(row, 'type');
  const nsType = authorizeNamespaceAndType(namespace, type);
  if (nsType !== null) return nsType;

  const parsed = parseEntityStoreRowData(row.values?.['data']);
  if (parsed === 'invalid') return deny('ENTITY_STORE_INVALID_DATA');

  const handler = ENTITY_STORE_TYPE_HANDLERS[type!];
  if (handler === undefined) return deny('ENTITY_STORE_TYPE_NOT_WRITABLE');
  return handler(auth, readRowString(row, 'owner_id'), parsed);
}

export function entityStoreTablePolicies(): readonly TablePolicy[] {
  return [
    {
      table: ENTITY_STORE_TABLE,
      allowedOps: PUT_PATCH_DELETE,
      allowedColumns: 'all',
      authorize: authorizeEntityStore,
    },
  ];
}
