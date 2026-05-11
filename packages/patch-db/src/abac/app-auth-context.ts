import type {
  PatchDbAuthContext,
  PatchDbContext,
  PatchDbQueryWhereClause,
  PatchInput,
} from '../interface';
import {
  isPatchDbAuthContext,
  PATCH_CREATED_BY_ID,
  READ_WHERE_NEVER_TRUE,
} from '../interface';
import { PATCH_DB_SYSTEM_DEVICE_ID } from '../policy/system-device';
import type { VisibilityPolicyReadContext } from '../policy/visibility-policy-registry';
import { ForbiddenError } from '../forbidden-error';

/**
 * Gamezilla-specific auth context: extends the generic patch-db auth context
 * with the claims needed by app visibility policies. The session middleware is
 * responsible for producing contexts of this shape.
 */
export type AppAuthContext = PatchDbAuthContext & {
  /** Signed-in account id, or `null` when anonymous (`x-anon-id`). */
  readonly accountId: string | null;
  /** Profile / space author id: `accountId` when signed in, else install id. */
  readonly myId: string;
  readonly memberOfSpaceIds: readonly string[];
  readonly friendUserIds: readonly string[];
  readonly blockedUserIds: readonly string[];
};

/**
 * Marker for unauthenticated HTTP callers (no Bearer, no `x-anon-id`).
 * Carries no identity claims; ABAC policies decide what (if anything) such
 * callers may read.
 */
export type AppClientContext = {
  readonly deviceId?: undefined;
};

type AppReadContext = VisibilityPolicyReadContext<AppAuthContext>;

/**
 * Wraps an authenticated-only read function so it can be assigned directly to
 * `VisibilityPolicy.read`. Unauthenticated clients get {@link READ_WHERE_NEVER_TRUE} (no
 * rows) without each policy repeating the narrowing check.
 */
export function authOnlyRead(
  fn: (ctx: AppAuthContext) => PatchDbQueryWhereClause
): (ctx: AppReadContext) => PatchDbQueryWhereClause {
  return (ctx) =>
    isPatchDbAuthContext(ctx)
      ? fn(ctx as AppAuthContext)
      : READ_WHERE_NEVER_TRUE;
}

/** Client-only writes skip the auth branch; session middleware always uses {@link AppAuthContext}. */
export function appAuthFromWriteContext(
  ctx: PatchDbContext
): AppAuthContext | null {
  if (!isPatchDbAuthContext(ctx)) return null;
  return ctx as AppAuthContext;
}

function createdBy(patch: PatchInput): string {
  const raw = patch as Record<string, unknown>;
  const top =
    typeof raw['createdBy'] === 'string' ? (raw['createdBy'] as string) : '';
  const attr = patch.attributes[PATCH_CREATED_BY_ID];
  return top || (typeof attr === 'string' ? attr : '');
}

export function assertCreatedByMatchesAuthor(
  ctx: PatchDbAuthContext,
  patch: PatchInput
): void {
  const app = ctx as AppAuthContext;
  const cb = createdBy(patch);
  if (cb !== app.myId && cb !== PATCH_DB_SYSTEM_DEVICE_ID) {
    throw new ForbiddenError('patch/created-by-id must match author', {
      expected: app.myId,
      actual: cb,
    });
  }
}
