import { useMyId } from '@libs/auth-client/use-current-user';
import { DenialSurface } from '@libs/permissions-client/denial-surface';
import { useLimitDecision } from '@libs/permissions-client/use-can';
import { LIMIT } from '@libs/permissions-shared/permission-catalog';
import { endSpaceMutation } from '@libs/spaces-shared/end-space-mutation';
import { Handles } from '@libs/test-ids-shared/handles';
import type { Decision } from '@pkgs/permissions-shared/decision';
import sql from '@pkgs/sql-root-shared/sql';
import { useMutationClient } from '@pkgs/sync-engine-client/mutation-client-context';
import {
  createQuery,
  useSyncEngine,
} from '@pkgs/sync-engine-client/sync-engine-context';
import { useRouter } from '@pkgs/ui-root-client/app-router';
import {
  type Accessor,
  createContext,
  createEffect,
  createSignal,
  type JSX,
  Show,
  useContext,
} from 'solid-js';

import { SpaceProbe } from './space-probe';
import { openSpaceDetail, useSpaceRouteId } from './space-routes';
import { useHostedSpaceCount } from './use-hosted-space-count';

type HostedRow = { readonly id: string; readonly host_id: string | null };

/**
 * A second space made on another device while the two could not agree.
 * Spaces one device already hosts, including those kept after paid access
 * ends, stay open.
 */
function spacesFromAnotherDevice(
  rows: readonly HostedRow[]
): readonly string[] {
  const keep = rows[0];
  if (keep === undefined) return [];
  return rows
    .filter((row) => row.id !== keep.id && row.host_id !== keep.host_id)
    .map((row) => row.id);
}

type HostingInviteApi = {
  readonly decision: Accessor<Decision | null>;
  readonly note: (decision: Decision) => void;
  readonly clear: () => void;
};

const HostingInviteContext = createContext<HostingInviteApi | null>(null);

export function useHostingInvite(): HostingInviteApi {
  const ctx = useContext(HostingInviteContext);
  if (ctx !== null) return ctx;
  return {
    decision: () => null,
    note: () => undefined,
    clear: () => undefined,
  };
}

function useHostedSpaceIds(): {
  readonly ids: Accessor<readonly string[]>;
  readonly rows: Accessor<readonly HostedRow[]>;
  readonly isLoading: Accessor<boolean>;
} {
  const myId = useMyId();
  const query = createQuery(
    () =>
      sql<HostedRow>`
      SELECT id, host_id FROM spaces
      WHERE ended_at IS NULL
        AND deleted_at IS NULL
        AND (host_member_id = ${myId()} OR host_account_id = ${myId()})
      ORDER BY created_at ASC
    `
  );
  return {
    ids: () => query.rows().map((row) => row.id),
    rows: query.rows,
    isLoading: query.isLoading,
  };
}

async function collapseExtraSpaces(args: {
  readonly drop: readonly string[];
  readonly keep: string;
  readonly decision: Decision;
  readonly note: (decision: Decision) => void;
  readonly mutate: (spaceId: string) => Promise<unknown>;
  readonly routeId: string;
  readonly openKept: (spaceId: string) => void;
}): Promise<void> {
  args.note(args.decision);
  for (const spaceId of args.drop) await args.mutate(spaceId);
  if (args.drop.includes(args.routeId)) args.openKept(args.keep);
}

function HostingCollapse(props: {
  readonly note: (decision: Decision) => void;
}): null {
  const engine = useSyncEngine();
  const hosted = useHostedSpaceCount();
  const spaces = useHostedSpaceIds();
  const over = useLimitDecision(LIMIT.hostedSpaces, () =>
    Math.max(0, hosted.count() - 1)
  );
  const mutationClient = useMutationClient();
  const router = useRouter();
  const routeId = useSpaceRouteId();
  const collapsing = { current: false };

  createEffect(() => {
    const online = engine.status().online;
    const ids = spaces.ids();
    const decision = over();
    if (
      collapsing.current ||
      !online ||
      hosted.isLoading() ||
      spaces.isLoading() ||
      decision.allowed ||
      ids.length < 2
    )
      return;
    const keep = ids[0];
    const drop = spacesFromAnotherDevice(spaces.rows());
    if (keep === undefined || drop.length === 0) return;
    collapsing.current = true;
    void collapseExtraSpaces({
      drop,
      keep,
      decision,
      note: props.note,
      mutate: (spaceId) => mutationClient.mutate(endSpaceMutation, { spaceId }),
      routeId: routeId(),
      openKept: (spaceId) => openSpaceDetail(router, spaceId),
    }).finally(() => {
      collapsing.current = false;
    });
  });

  return null;
}

/** Hosting count, the Plus invitation, and ending a second space another device made. */
export function HostingAccount(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const spaces = useHostedSpaceIds();
  const [decision, setDecision] = createSignal<Decision | null>(null);
  const note = (next: Decision): void => {
    setDecision(next);
  };
  const clear = (): void => {
    setDecision(null);
  };
  // Ending a space or completing checkout answers the invitation explicitly.
  // Reconnecting can temporarily change the permission facts; it does not
  // answer a refusal. This provider is its only presentation owner.
  const api: HostingInviteApi = { decision, note, clear };

  return (
    <HostingInviteContext.Provider value={api}>
      <HostingCollapse note={note} />
      <SpaceProbe testId={Handles.spacesHostedProbe}>
        {spaces.ids().join('\n')}
      </SpaceProbe>
      <Show when={decision()}>
        {(shown) => (
          <DenialSurface
            decision={shown()}
            variant="compact"
            testId={Handles.spacesHostingLimit}
          />
        )}
      </Show>
      {props.children}
    </HostingInviteContext.Provider>
  );
}
