import { EmptyState } from '@pkgs/ui';
import { For, type JSX, Show } from 'solid-js';
import {
  coerceDebuggerView,
  type DebuggerViewId,
  defaultViewForKind,
  viewsForKind,
} from '../../shared/debugger-views';
import type {
  ProductSimulatorActor,
  ProductSimulatorRoomNode,
  ProductSimulatorSession,
} from '../../shared/ports';
import type { SimChromeKind } from '../../shared/sim-node';
import { DebuggerColumn, DebuggerColumns } from '../debugger/debugger-columns';
import { useSimConsoleLayout } from '../debugger/use-sim-console-layout';
import type { PaneNavPatch, PaneNavValue } from '../debugger-chrome';
import {
  ClientProductSimulatorPanel,
  PubSubProductSimulatorPanel,
  RoomProductSimulatorPanel,
  ServerProductSimulatorPanel,
} from './product-simulator-panel';

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

export function productSimulatorInstancesForKind(
  session: ProductSimulatorSession,
  kind: SimChromeKind,
  clients: readonly ProductSimulatorActor[]
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
    return [{ id: session.server.id, kind: 'server' }];
  }
  return [{ id: session.pubsub.id, kind: 'events' }];
}

export function resolveProductSimulatorInstanceId(
  instance: string,
  instances: readonly { readonly id: string }[]
): string | null {
  if (instances.length === 0) return null;
  const match = instances.find((n) => n.id === instance);
  if (match !== undefined) return match.id;
  return instances[0]?.id ?? null;
}

export function resolveProductSimulatorPane(
  panes: Readonly<Record<string, PaneNavValue>>,
  paneId: string,
  kind: SimChromeKind
): PaneNavValue {
  const direct = panes[paneId];
  if (direct !== undefined) {
    return {
      view: coerceDebuggerView(kind, direct.view),
    };
  }
  if ((kind === 'server' || kind === 'events') && panes[kind] !== undefined) {
    const byKind = panes[kind]!;
    return {
      view: coerceDebuggerView(kind, byKind.view),
    };
  }
  return { view: defaultViewForKind(kind) };
}

export function productSimulatorPaneKey(
  kind: SimChromeKind,
  instanceId: string | null
): string {
  if (kind === 'server' || kind === 'events') return kind;
  return instanceId ?? '';
}

export function ProductSimulatorKindPane(props: {
  readonly session: ProductSimulatorSession;
  readonly kind: SimChromeKind;
  readonly panes: Readonly<Record<string, PaneNavValue>>;
  readonly instanceId: string | null;
  readonly clients: readonly ProductSimulatorActor[];
  readonly snapshotEpoch: number;
  readonly focusedClientId: string | null;
  readonly onFocusedClientIdChange: (id: string | null) => void;
  readonly onPanePatch: (
    id: string,
    patch: PaneNavPatch,
    mode?: 'push' | 'replace'
  ) => void;
  readonly onClientColumnsOutsidePointerDown?: () => void;
  readonly clientColumnShell?: (args: {
    readonly actor: ProductSimulatorActor;
    readonly focused: boolean;
    readonly onActivate: () => void;
    readonly children: JSX.Element;
  }) => JSX.Element;
}): JSX.Element {
  const room = () => resolveRoom(props.session, props.instanceId);
  const serverPaneKey = () =>
    productSimulatorPaneKey('server', props.session.server.id);
  const eventsPaneKey = () =>
    productSimulatorPaneKey('events', props.session.pubsub.id);
  const roomPaneKey = () => {
    const r = room();
    return r !== null ? productSimulatorPaneKey('room', r.id) : 'room';
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
      <div class="box" style={kindVisibilitySx(props.kind === 'server')}>
        <ServerProductSimulatorPanel
          session={props.session}
          node={props.session.server}
          pane={resolveProductSimulatorPane(
            props.panes,
            serverPaneKey(),
            'server'
          )}
          onPanePatch={(patch, mode) =>
            props.onPanePatch(serverPaneKey(), patch, mode)
          }
        />
      </div>
      <div class="box" style={kindVisibilitySx(props.kind === 'events')}>
        <PubSubProductSimulatorPanel
          session={props.session}
          pubsub={props.session.pubsub}
          pane={resolveProductSimulatorPane(
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
            <RoomProductSimulatorPanel
              session={props.session}
              room={resolvedRoom()}
              pane={resolveProductSimulatorPane(
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

export function productSimulatorViewsForKind(
  kind: SimChromeKind
): readonly DebuggerViewId[] {
  return viewsForKind(kind);
}

export function productSimulatorViewForKind(
  kind: SimChromeKind,
  raw: string
): DebuggerViewId {
  return coerceDebuggerView(kind, raw);
}

function resolveRoom(
  session: ProductSimulatorSession,
  instanceId: string | null
): ProductSimulatorRoomNode | null {
  const rooms = [...session.rooms.values()];
  if (rooms.length === 0) return null;
  if (instanceId === null) return rooms[0] ?? null;
  return rooms.find((r) => r.id === instanceId) ?? rooms[0] ?? null;
}

function ClientLiveColumns(props: {
  readonly session: ProductSimulatorSession;
  readonly clients: readonly ProductSimulatorActor[];
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
  readonly clientColumnShell?: (args: {
    readonly actor: ProductSimulatorActor;
    readonly focused: boolean;
    readonly onActivate: () => void;
    readonly children: JSX.Element;
  }) => JSX.Element;
}): JSX.Element {
  const layout = useSimConsoleLayout();
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
            const panel = (
              <ClientProductSimulatorPanel
                actor={actor}
                session={props.session}
                snapshotEpoch={props.snapshotEpoch}
                reloadToken={props.session.revision}
                pane={resolveProductSimulatorPane(
                  props.panes,
                  actor.id,
                  'client'
                )}
                onPanePatch={(patch, mode) =>
                  props.onPanePatch(actor.id, patch, mode)
                }
              />
            );
            const body = () =>
              props.clientColumnShell !== undefined ? (
                props.clientColumnShell({
                  actor,
                  focused: focused(),
                  onActivate: () => props.onFocusedClientIdChange(actor.id),
                  children: panel,
                })
              ) : (
                <DebuggerColumn>{panel}</DebuggerColumn>
              );
            return (
              <Show
                when={layout.multiClientColumns}
                fallback={
                  <div
                    class="box flex-1 min-w-[0] min-h-[0] flex-col"
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
