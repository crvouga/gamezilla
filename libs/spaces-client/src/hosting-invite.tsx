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

import { openSpaceDetail, useSpaceRouteId } from './space-routes';
import { useHostedSpaceCount } from './use-hosted-space-count';

type HostedRow = { readonly id: string };

type HostingInviteApi = {
  readonly decision: Accessor<Decision | null>;
  readonly note: (decision: Decision) => void;
};

const HostingInviteContext = createContext<HostingInviteApi | null>(null);

export function useHostingInvite(): HostingInviteApi {
  const ctx = useContext(HostingInviteContext);
  if (ctx !== null) return ctx;
  return { decision: () => null, note: () => undefined };
}

function useHostedSpaceIds(): {
  readonly ids: Accessor<readonly string[]>;
  readonly isLoading: Accessor<boolean>;
} {
  const myId = useMyId();
  const query = createQuery(
    () =>
      sql<HostedRow>`
      SELECT id FROM spaces
      WHERE ended_at IS NULL
        AND deleted_at IS NULL
        AND (host_member_id = ${myId()} OR host_account_id = ${myId()})
      ORDER BY created_at ASC
    `
  );
  return {
    ids: () => query.rows().map((row) => row.id),
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
    if (keep === undefined) return;
    const drop = ids.slice(1);
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

/** Hosting count, the Plus invitation, and collapsing a free account's extra space. */
export function HostingAccount(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const spaces = useHostedSpaceIds();
  const [decision, setDecision] = createSignal<Decision | null>(null);
  const note = (next: Decision): void => {
    setDecision(next);
  };
  const api: HostingInviteApi = { decision, note };

  return (
    <HostingInviteContext.Provider value={api}>
      <HostingCollapse note={note} />
      <span
        data-testid={Handles.spacesHostedProbe}
        class="hidden"
        aria-hidden="true"
      >
        {spaces.ids().join('\n')}
      </span>
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
