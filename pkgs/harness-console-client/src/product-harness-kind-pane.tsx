import { EmptyState } from '@pkgs/ui-client/empty-state';
import { For, type JSX, type ParentComponent, Show } from 'solid-js';
import { coerceDebuggerView, defaultViewForKind, viewsForKind } from '@pkgs/harness-console-shared/debugger-views';
import type { DebuggerViewId } from '@pkgs/harness-console-shared/debugger-views';
import type { HarnessChromeKind } from '@pkgs/harness-console-shared/node';
import type {
  ProductHarnessActor,
  ProductHarnessRoomNode,
  ProductHarnessSession,
  ProductHarnessSqlNode,
} from '@pkgs/harness-console-shared/ports';
import { DebuggerColumn, DebuggerColumns } from './debugger-columns';
import { useHarnessConsoleLayout } from './use-harness-console-layout';
import type { PaneNavPatch, PaneNavValue } from './debugger-chrome';
import {
  ClientProductHarnessPanel,
  LoadBalancerProductHarnessPanel,
  PubSubProductHarnessPanel,
  RoomProductHarnessPanel,
  ServerProductHarnessPanel,
} from './product-harness-panel';

export type ProductHarnessClientColumnShellProps = {
  readonly actor: ProductHarnessActor;
  readonly focused: boolean;
  readonly onActivate: () => void;
};

export type ProductHarnessClientColumnShell =
  ParentComponent<ProductHarnessClientColumnShellProps>;

const kindFillSx = {
  flex: 1,
  'min-width': 0,
  'min-height': 0,
} as const;

function kindVisibilitySx(active: boolean) {
  return {
    ...kindFillSx,
    display: active ? ('flex' as const) : ('none' as const),
    pointerEvents: active ? ('auto' as const) : ('none' as const),
  };
}

export function productHarnessInstancesForKind(
  session: ProductHarnessSession,
  kind: HarnessChromeKind,
  clients: readonly ProductHarnessActor[]
): readonly { readonly id: string; readonly kind: string }[] {
  if (kind === 'client') {
    return clients.map((actor) => ({ id: actor.id, kind: 'client' }));
  }
  if (kind === 'room') {
    return [...session.rooms.values()].map((room) => ({
      id: room.id,
      kind: 'room',
    }));
  }
  if (kind === 'server') {
    return [...session.servers.values()].map((server) => ({
      id: server.id,
      kind: 'server',
    }));
  }
  if (kind === 'lb') {
    return [{ id: session.loadBalancer.id, kind: 'lb' }];
  }
  return [{ id: session.pubsub.id, kind: 'events' }];
}

export function resolveProductHarnessInstanceId(
  instance: string,
  instances: readonly { readonly id: string }[]
): string | null {
  if (instances.length === 0) return null;
  const match = instances.find((n) => n.id === instance);
  if (match !== undefined) return match.id;
  return instances[0]?.id ?? null;
}

export function resolveProductHarnessPane(
  panes: Readonly<Record<string, PaneNavValue>>,
  paneId: string,
  kind: HarnessChromeKind
): PaneNavValue {
  const direct = panes[paneId];
  if (direct !== undefined) {
    return {
      view: coerceDebuggerView(kind, direct.view),
    };
  }
  if ((kind === 'lb' || kind === 'events') && panes[kind] !== undefined) {
    const byKind = panes[kind]!;
    return {
      view: coerceDebuggerView(kind, byKind.view),
    };
  }
  return { view: defaultViewForKind(kind) };
}

export function productHarnessPaneKey(
  kind: HarnessChromeKind,
  instanceId: string | null
): string {
  if (kind === 'lb' || kind === 'events') return kind;
  // Server panes are per instance — each instance keeps its own view.
  if (kind === 'server') return `server:${instanceId ?? ''}`;
  return instanceId ?? '';
}

export function ProductHarnessKindPane(props: {
  readonly session: ProductHarnessSession;
  readonly kind: HarnessChromeKind;
  readonly panes: Readonly<Record<string, PaneNavValue>>;
  readonly instanceId: string | null;
  readonly clients: readonly ProductHarnessActor[];
  readonly snapshotEpoch: number;
  readonly focusedClientId: string | null;
  readonly onFocusedClientIdChange: (id: string | null) => void;
  readonly onPanePatch: (
    id: string,
    patch: PaneNavPatch,
    mode?: 'push' | 'replace'
  ) => void;
  readonly onClientColumnsOutsidePointerDown?: () => void;
  readonly clientColumnShell?: ProductHarnessClientColumnShell;
}): JSX.Element {
  const room = () => resolveRoom(props.session, props.instanceId);
  const server = () => resolveServer(props.session, props.instanceId);
  const serverPaneKey = () =>
    productHarnessPaneKey('server', server()?.id ?? null);
  const eventsPaneKey = () =>
    productHarnessPaneKey('events', props.session.pubsub.id);
  const roomPaneKey = () => {
    const r = room();
    return r !== null ? productHarnessPaneKey('room', r.id) : 'room';
  };

  return (
    <>
      <div class="box" style={kindVisibilitySx(props.kind === 'client')}>
        <ClientLiveColumns
          session={props.session}
          clients={props.clients}
          panes={props.panes}
          instanceId={props.instanceId}
          snapshotEpoch={props.snapshotEpoch}
          focusedClientId={props.focusedClientId}
          onFocusedClientIdChange={props.onFocusedClientIdChange}
          onPanePatch={props.onPanePatch}
          {...(props.onClientColumnsOutsidePointerDown !== undefined
            ? { onOutsidePointerDown: props.onClientColumnsOutsidePointerDown }
            : {})}
          {...(props.clientColumnShell !== undefined
            ? { clientColumnShell: props.clientColumnShell }
            : {})}
        />
      </div>
      <div class="box" style={kindVisibilitySx(props.kind === 'lb')}>
        <LoadBalancerProductHarnessPanel
          session={props.session}
          loadBalancer={props.session.loadBalancer}
          pane={resolveProductHarnessPane(props.panes, 'lb', 'lb')}
        />
      </div>
      <div class="box" style={kindVisibilitySx(props.kind === 'server')}>
        <Show
          when={server()}
          fallback={<EmptyKind body="No server instances in this session." />}
        >
          {(resolvedServer) => (
            <ServerProductHarnessPanel
              session={props.session}
              node={resolvedServer()}
              pane={resolveProductHarnessPane(
                props.panes,
                serverPaneKey(),
                'server'
              )}
              onPanePatch={(patch, mode) =>
                props.onPanePatch(serverPaneKey(), patch, mode)
              }
            />
          )}
        </Show>
      </div>
      <div class="box" style={kindVisibilitySx(props.kind === 'events')}>
        <PubSubProductHarnessPanel
          session={props.session}
          pubsub={props.session.pubsub}
          pane={resolveProductHarnessPane(
            props.panes,
            eventsPaneKey(),
            'events'
          )}
        />
      </div>
      <div class="box" style={kindVisibilitySx(props.kind === 'room')}>
        <Show
          when={room()}
          fallback={<EmptyKind body="No room instances in this session." />}
        >
          {(resolvedRoom) => (
            <RoomProductHarnessPanel
              session={props.session}
              room={resolvedRoom()}
              pane={resolveProductHarnessPane(
                props.panes,
                roomPaneKey(),
                'room'
              )}
            />
          )}
        </Show>
      </div>
    </>
  );
}

export function productHarnessViewsForKind(
  kind: HarnessChromeKind
): readonly DebuggerViewId[] {
  return viewsForKind(kind);
}

export function productHarnessViewForKind(
  kind: HarnessChromeKind,
  raw: string
): DebuggerViewId {
  return coerceDebuggerView(kind, raw);
}

function resolveServer(
  session: ProductHarnessSession,
  instanceId: string | null
): ProductHarnessSqlNode | null {
  const servers = [...session.servers.values()];
  if (servers.length === 0) return null;
  if (instanceId === null) return servers[0] ?? null;
  return servers.find((s) => s.id === instanceId) ?? servers[0] ?? null;
}

function resolveRoom(
  session: ProductHarnessSession,
  instanceId: string | null
): ProductHarnessRoomNode | null {
  const rooms = [...session.rooms.values()];
  if (rooms.length === 0) return null;
  if (instanceId === null) return rooms[0] ?? null;
  return rooms.find((r) => r.id === instanceId) ?? rooms[0] ?? null;
}

function ClientLiveColumns(props: {
  readonly session: ProductHarnessSession;
  readonly clients: readonly ProductHarnessActor[];
  readonly panes: Readonly<Record<string, PaneNavValue>>;
  readonly instanceId: string | null;
  readonly snapshotEpoch: number;
  readonly focusedClientId: string | null;
  readonly onFocusedClientIdChange: (id: string | null) => void;
  readonly onPanePatch: (
    id: string,
    patch: PaneNavPatch,
    mode?: 'push' | 'replace'
  ) => void;
  readonly onOutsidePointerDown?: () => void;
  readonly clientColumnShell?: ProductHarnessClientColumnShell;
}): JSX.Element {
  const layout = useHarnessConsoleLayout();
  return (
    <Show
      when={props.clients.length > 0}
      fallback={<EmptyKind body="No clients in this session." />}
    >
      <DebuggerColumns
        {...(props.onOutsidePointerDown !== undefined
          ? { onOutsidePointerDown: props.onOutsidePointerDown }
          : {})}
      >
        <For each={props.clients}>
          {(actor) => {
            const selected = () =>
              props.instanceId !== null
                ? actor.id === props.instanceId
                : actor.id === props.clients[0]?.id;
            const visible = () => layout.multiClientColumns || selected();
            const focused = () =>
              layout.multiClientColumns
                ? props.focusedClientId === actor.id
                : selected();
            // Panel must be written as JSX children of the shell (not a
            // pre-built element) so it mounts under `KeyboardShortcutScope`.
            const Shell = props.clientColumnShell;
            const body = () =>
              Shell !== undefined ? (
                <Shell
                  actor={actor}
                  focused={focused()}
                  onActivate={() => props.onFocusedClientIdChange(actor.id)}
                >
                  <ClientLiveColumnPanel
                    actor={actor}
                    session={props.session}
                    snapshotEpoch={props.snapshotEpoch}
                    panes={props.panes}
                    onPanePatch={props.onPanePatch}
                  />
                </Shell>
              ) : (
                <DebuggerColumn>
                  <ClientLiveColumnPanel
                    actor={actor}
                    session={props.session}
                    snapshotEpoch={props.snapshotEpoch}
                    panes={props.panes}
                    onPanePatch={props.onPanePatch}
                  />
                </DebuggerColumn>
              );
            return (
              <Show
                when={layout.multiClientColumns}
                fallback={
                  <div
                    class="box flex-1 min-w-0 min-h-0 flex-col"
                    style={{ display: visible() ? 'flex' : 'none' }}
                  >
                    {body()}
                  </div>
                }
              >
                {body()}
              </Show>
            );
          }}
        </For>
      </DebuggerColumns>
    </Show>
  );
}

function EmptyKind(props: { readonly body: string }) {
  return (
    <div class="box flex-1 items-center justify-center bg-background p-[4px]">
      <EmptyState
        variant="compact"
        title="Nothing selected"
        body={props.body}
      />
    </div>
  );
}

function ClientLiveColumnPanel(props: {
  readonly actor: ProductHarnessActor;
  readonly session: ProductHarnessSession;
  readonly snapshotEpoch: number;
  readonly panes: Readonly<Record<string, PaneNavValue>>;
  readonly onPanePatch: (
    id: string,
    patch: PaneNavPatch,
    mode?: 'push' | 'replace'
  ) => void;
}): JSX.Element {
  return (
    <ClientProductHarnessPanel
      actor={props.actor}
      session={props.session}
      snapshotEpoch={props.snapshotEpoch}
      reloadToken={props.session.revision}
      pane={resolveProductHarnessPane(props.panes, props.actor.id, 'client')}
      onPanePatch={(patch, mode) =>
        props.onPanePatch(props.actor.id, patch, mode)
      }
    />
  );
}
