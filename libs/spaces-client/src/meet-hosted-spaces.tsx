import { useMyId } from '@libs/auth-client/use-current-user';
import { useLimitDecision } from '@libs/permissions-client/use-can';
import { LIMIT } from '@libs/permissions-shared/permission-catalog';
import { Handles } from '@libs/test-ids-shared/handles';
import sql from '@pkgs/sql-root-shared/sql';
import { createQuery } from '@pkgs/sync-engine-client/sync-engine-context';
import { usePathname, useRouter } from '@pkgs/ui-root-client/app-router';
import { type Accessor, createEffect, createMemo, type JSX } from 'solid-js';
import { useHostingInvite } from './hosting-invite';
import { spaceDetailHref } from './space-routes';

type IdRow = { readonly id: string };
type ArgsRow = { readonly args: string };

function routeSpaceId(path: string): string | null {
  const match = /^\/space\/([^/?#]+)/.exec(path);
  return match?.[1] ?? null;
}

function spaceIdFromArgs(args: string): string | null {
  try {
    const parsed: unknown = JSON.parse(args);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const id = (parsed as { spaceId?: unknown }).spaceId;
    return typeof id === 'string' && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

function idsOf(rows: readonly IdRow[]): ReadonlySet<string> {
  return new Set(rows.map((row) => row.id));
}

/** Live spaces this person hosts, earliest first. */
function useLiveHostedIds(): Accessor<readonly string[]> {
  const myId = useMyId();
  const query = createQuery(
    () => sql<IdRow>`
    SELECT id FROM spaces
    WHERE ended_at IS NULL
      AND deleted_at IS NULL
      AND (host_member_id = ${myId()} OR host_account_id = ${myId()})
    ORDER BY created_at ASC
  `
  );
  return createMemo(() => query.rows().map((row) => row.id));
}

/** A create that the account refused because one live space is the limit. */
function useRejectedCreateIds(): Accessor<ReadonlySet<string>> {
  const query = createQuery(
    () => sql<ArgsRow>`
    SELECT m.args AS args
    FROM sync_engine_write_rejections AS r
    INNER JOIN sync_engine_mutations AS m ON m.id = r.mutation_id
    WHERE r.deleted_at IS NULL
      AND r.code = ${'limit_reached'}
      AND m.name = ${'createSpace'}
  `
  );
  return createMemo(() => {
    const ids = new Set<string>();
    for (const row of query.rows()) {
      const id = spaceIdFromArgs(row.args);
      if (id !== null) ids.add(id);
    }
    return ids;
  });
}

function useFlaggedHosted(): Accessor<boolean> {
  const myId = useMyId();
  const query = createQuery(
    () => sql<IdRow>`
    SELECT id FROM spaces
    WHERE hosting_limit_reached = ${true}
      AND ended_at IS NULL
      AND deleted_at IS NULL
      AND (host_member_id = ${myId()} OR host_account_id = ${myId()})
    LIMIT 1
  `
  );
  return createMemo(() => query.rows().length > 0);
}

function useEndedHostedIds(): Accessor<ReadonlySet<string>> {
  const myId = useMyId();
  const query = createQuery(
    () => sql<IdRow>`
    SELECT id FROM spaces
    WHERE ended_at IS NOT NULL
      AND (host_member_id = ${myId()} OR host_account_id = ${myId()})
  `
  );
  return createMemo(() => idsOf(query.rows()));
}

/**
 * The device whose later space was the one too many follows the earlier
 * space, and the account is invited to Plus.
 */
export function MeetHostedSpaces(): JSX.Element {
  const path = usePathname();
  const router = useRouter();
  const live = useLiveHostedIds();
  const rejected = useRejectedCreateIds();
  const ended = useEndedHostedIds();
  const flagged = useFlaggedHosted();
  const invited = useHostingInvite();
  const over = createMemo(
    () =>
      flagged() ||
      [...rejected()].some((id) => !ended().has(id)) ||
      invited.decision() !== null
  );
  const decision = useLimitDecision(LIMIT.hostedSpaces, () => (over() ? 1 : 0));
  createEffect(() => {
    if (!over()) return;
    const answer = decision();
    if (!answer.allowed) invited.note(answer);
  });

  createEffect(() => {
    const current = routeSpaceId(path());
    const earliest = live()[0];
    if (current === null || earliest === undefined || current === earliest)
      return;
    const refused = rejected().has(current);
    const collapsed = flagged() && ended().has(current);
    if (!refused && !collapsed) return;
    router.replace(spaceDetailHref(earliest));
  });

  return (
    <>
      <span
        data-testid={Handles.spacesHostingLive}
        class="hidden"
        aria-hidden="true"
      >
        {live().join(' ')}
      </span>
    </>
  );
}
