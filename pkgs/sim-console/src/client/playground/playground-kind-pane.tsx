import { Box, EmptyState } from '@pkgs/ui';
import { For, type JSX, Show } from 'solid-js';
import {
  coerceDebuggerView,
  type DebuggerViewId,
  defaultViewForKind,
  viewsForKind,
} from '../../shared/debugger-views';
import type {
  PlaygroundActor,
  PlaygroundRoomNode,
  PlaygroundSession,
} from '../../shared/ports';
import type { SimChromeKind } from '../../shared/sim-node';
import { DebuggerColumn, DebuggerColumns } from '../debugger/debugger-columns';
import { useSimConsoleLayout } from '../debugger/use-sim-console-layout';
import type { PaneNavPatch, PaneNavValue } from '../debugger-chrome';
import {
  ClientPlaygroundPanel,
  PubSubPlaygroundPanel,
  RoomPlaygroundPanel,
  ServerPlaygroundPanel,
} from './playground-panel';

const kindFillSx = {
  flex: 1,
  minWidth: 0,
  minHeight: 0,
} as const;

function kindVisibilitySx(active: boolean) {
  return {
    ...kindFillSx,
    display: active ? ('flex' as const) : ('none' as const),
    pointerEvents: active ? ('auto' as const) : ('none' as const),
  };
}

export function playgroundInstancesForKind(
  session: PlaygroundSession,
  kind: SimChromeKind,
  clients: readonly PlaygroundActor[]
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

export function resolvePlaygroundInstanceId(
  instance: string,
  instances: readonly { readonly id: string }[]
): string | null {
  if (instances.length === 0) return null;
  const match = instances.find((n) => n.id === instance);
  if (match !== undefined) return match.id;
  return instances[0]?.id ?? null;
}

export function resolvePlaygroundPane(
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

export function playgroundPaneKey(
  kind: SimChromeKind,
  instanceId: string | null
): string {
  if (kind === 'server' || kind === 'events') return kind;
  return instanceId ?? '';
}

export function PlaygroundKindPane(props: {
  readonly session: PlaygroundSession;
  readonly kind: SimChromeKind;
  readonly panes: Readonly<Record<string, PaneNavValue>>;
  readonly instanceId: string | null;
  readonly clients: readonly PlaygroundActor[];
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
    readonly actor: PlaygroundActor;
    readonly focused: boolean;
    readonly onActivate: () => void;
    readonly children: JSX.Element;
  }) => JSX.Element;
}): JSX.Element {
  const room = () => resolveRoom(props.session, props.instanceId);
  const serverPaneKey = () =>
    playgroundPaneKey('server', props.session.server.id);
  const eventsPaneKey = () =>
    playgroundPaneKey('events', props.session.pubsub.id);
  const roomPaneKey = () => {
    const r = room();
    return r !== null ? playgroundPaneKey('room', r.id) : 'room';
  };

  return (
    <>
      <Box sx={kindVisibilitySx(props.kind === 'client')}>
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
      </Box>
      <Box sx={kindVisibilitySx(props.kind === 'server')}>
        <ServerPlaygroundPanel
          session={props.session}
          node={props.session.server}
          pane={resolvePlaygroundPane(props.panes, serverPaneKey(), 'server')}
          onPanePatch={(patch, mode) =>
            props.onPanePatch(serverPaneKey(), patch, mode)
          }
        />
      </Box>
      <Box sx={kindVisibilitySx(props.kind === 'events')}>
        <PubSubPlaygroundPanel
          session={props.session}
          pubsub={props.session.pubsub}
          pane={resolvePlaygroundPane(props.panes, eventsPaneKey(), 'events')}
        />
      </Box>
      <Box sx={kindVisibilitySx(props.kind === 'room')}>
        <Show
          when={room()}
          fallback={<EmptyKind body="No room instances in this session." />}
        >
          {(resolvedRoom) => (
            <RoomPlaygroundPanel
              session={props.session}
              room={resolvedRoom()}
              pane={resolvePlaygroundPane(props.panes, roomPaneKey(), 'room')}
            />
          )}
        </Show>
      </Box>
    </>
  );
}

export function playgroundViewsForKind(
  kind: SimChromeKind
): readonly DebuggerViewId[] {
  return viewsForKind(kind);
}

export function playgroundViewForKind(
  kind: SimChromeKind,
  raw: string
): DebuggerViewId {
  return coerceDebuggerView(kind, raw);
}

function resolveRoom(
  session: PlaygroundSession,
  instanceId: string | null
): PlaygroundRoomNode | null {
  const rooms = [...session.rooms.values()];
  if (rooms.length === 0) return null;
  if (instanceId === null) return rooms[0] ?? null;
  return rooms.find((r) => r.id === instanceId) ?? rooms[0] ?? null;
}

function ClientLiveColumns(props: {
  readonly session: PlaygroundSession;
  readonly clients: readonly PlaygroundActor[];
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
    readonly actor: PlaygroundActor;
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
              <ClientPlaygroundPanel
                actor={actor}
                session={props.session}
                snapshotEpoch={props.snapshotEpoch}
                reloadToken={props.session.revision}
                pane={resolvePlaygroundPane(props.panes, actor.id, 'client')}
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
                  <Box
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      minHeight: 0,
                      flexDirection: 'column',
                      display: visible() ? 'flex' : 'none',
                    }}
                  >
                    {body()}
                  </Box>
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
    <Box
      sx={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        background: 'background',
        padding: 4,
      }}
    >
      <EmptyState
        variant="compact"
        title="Nothing selected"
        body={props.body}
      />
    </Box>
  );
}
