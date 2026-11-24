import { useMyId } from '@libs/auth-client-ts/use-current-user';
import { DenialModal } from '@libs/permissions-client-ts/denial-modal';
import { useLimitDecision } from '@libs/permissions-client-ts/use-can';
import { LIMIT } from '@libs/permissions-shared-ts/permission-catalog';
import { endSpaceMutation } from '@libs/spaces-shared-ts/end-space-mutation';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import type { Decision } from '@pkgs/permissions-shared-ts/decision';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import {
  createQuery,
  useSyncEngine,
} from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import type { JSX } from '@solidjs/web';
import {
  type Accessor,
  createContext,
  createEffect,
  createSignal,
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
  /**
   * The person asked for another space and was refused: the invitation
   * stands and its modal opens, however often they ask.
   */
  readonly offer: (decision: Decision) => void;
  /**
   * The app found the person over their limit on its own: the invitation
   * stands, and its modal opens only when the invitation is new, so a modal
   * the person closed stays closed.
   */
  readonly note: (decision: Decision) => void;
  /** Ending a space or completing checkout answers the invitation. */
  readonly clear: () => void;
};

const HostingInviteContext = createContext<HostingInviteApi | null>(null);

export function useHostingInvite(): HostingInviteApi {
  const ctx = useContext(HostingInviteContext);
  if (ctx !== null) return ctx;
  return {
    decision: () => null,
    offer: () => undefined,
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

  createEffect(
    () => {
      const online = engine.status().online;
      const ids = spaces.ids();
      const decision = over();
      if (
        !online ||
        hosted.isLoading() ||
        spaces.isLoading() ||
        decision.allowed ||
        ids.length < 2
      )
        return null;
      const keep = ids[0];
      const drop = spacesFromAnotherDevice(spaces.rows());
      if (keep === undefined || drop.length === 0) return null;
      return { keep, drop, decision, note: props.note, routeId: routeId() };
    },
    (plan) => {
      if (plan === null || collapsing.current) return;
      collapsing.current = true;
      void collapseExtraSpaces({
        ...plan,
        mutate: (spaceId) =>
          mutationClient.mutate(endSpaceMutation, { spaceId }),
        openKept: (spaceId) => openSpaceDetail(router, spaceId),
      }).finally(() => {
        collapsing.current = false;
      });
    }
  );

  return null;
}

/** Hosting count, the Plus invitation, and ending a second space another device made. */
export function HostingAccount(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const spaces = useHostedSpaceIds();
  const [decision, setDecision] = createSignal<Decision | null>(null);
  const [showing, setShowing] = createSignal(false);
  // Whether an invitation stands, known at once to callers that write it
  // from effects, before the signal settles.
  let standing = false;
  const offer = (next: Decision): void => {
    standing = true;
    setDecision(next);
    setShowing(true);
  };
  const note = (next: Decision): void => {
    if (!standing) setShowing(true);
    standing = true;
    setDecision(next);
  };
  const clear = (): void => {
    standing = false;
    setDecision(null);
    setShowing(false);
  };
  // Ending a space or completing checkout answers the invitation explicitly.
  // Reconnecting can temporarily change the permission facts; it does not
  // answer a refusal; closing the modal does not either. This provider is
  // its only presentation owner.
  const api: HostingInviteApi = { decision, offer, note, clear };

  return (
    <HostingInviteContext value={api}>
      <HostingCollapse note={note} />
      <SpaceProbe testId={Handles.spacesHostedProbe}>
        {spaces.ids().join('\n')}
      </SpaceProbe>
      <Show when={decision()}>
        {(shown) => (
          <DenialModal
            decision={shown()}
            visible={showing()}
            onDismiss={() => setShowing(false)}
            testId={Handles.spacesHostingLimit}
          />
        )}
      </Show>
      {props.children}
    </HostingInviteContext>
  );
}
