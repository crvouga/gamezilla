import { Box, EmptyState } from '@pkgs/ui-rn';
import type { ReactNode } from 'react';
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
    readonly children: ReactNode;
  }) => ReactNode;
}): ReactNode {
  const {
    session,
    kind,
    panes,
    instanceId,
    clients,
    snapshotEpoch,
    focusedClientId,
    onFocusedClientIdChange,
    onPanePatch,
    onClientColumnsOutsidePointerDown,
    clientColumnShell,
  } = props;

  const room = resolveRoom(session, instanceId);
  const serverPaneKey = playgroundPaneKey('server', session.server.id);
  const eventsPaneKey = playgroundPaneKey('events', session.pubsub.id);
  const roomPaneKey =
    room !== null ? playgroundPaneKey('room', room.id) : 'room';

  return (
    <>
      <Box sx={kindVisibilitySx(kind === 'client')}>
        <ClientLiveColumns
          session={session}
          clients={clients}
          panes={panes}
          instanceId={instanceId}
          snapshotEpoch={snapshotEpoch}
          focusedClientId={focusedClientId}
          onFocusedClientIdChange={onFocusedClientIdChange}
          onPanePatch={onPanePatch}
          {...(onClientColumnsOutsidePointerDown !== undefined
            ? { onOutsidePointerDown: onClientColumnsOutsidePointerDown }
            : {})}
          {...(clientColumnShell !== undefined ? { clientColumnShell } : {})}
        />
      </Box>
      <Box sx={kindVisibilitySx(kind === 'server')}>
        <ServerPlaygroundPanel
          session={session}
          node={session.server}
          pane={resolvePlaygroundPane(panes, serverPaneKey, 'server')}
          onPanePatch={(patch, mode) => onPanePatch(serverPaneKey, patch, mode)}
        />
      </Box>
      <Box sx={kindVisibilitySx(kind === 'events')}>
        <PubSubPlaygroundPanel
          session={session}
          pubsub={session.pubsub}
          pane={resolvePlaygroundPane(panes, eventsPaneKey, 'events')}
        />
      </Box>
      <Box sx={kindVisibilitySx(kind === 'room')}>
        {room === null ? (
          <EmptyKind body="No room instances in this session." />
        ) : (
          <RoomPlaygroundPanel
            session={session}
            room={room}
            pane={resolvePlaygroundPane(panes, roomPaneKey, 'room')}
          />
        )}
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
    readonly children: ReactNode;
  }) => ReactNode;
}): ReactNode {
  const {
    session,
    clients,
    panes,
    instanceId,
    snapshotEpoch,
    focusedClientId,
    onFocusedClientIdChange,
    onPanePatch,
    onOutsidePointerDown,
    clientColumnShell,
  } = props;
  const { multiClientColumns } = useSimConsoleLayout();
  if (clients.length === 0) {
    return <EmptyKind body="No clients in this session." />;
  }
  return (
    <DebuggerColumns
      {...(onOutsidePointerDown !== undefined ? { onOutsidePointerDown } : {})}
    >
      {clients.map((actor) => {
        const selected =
          instanceId !== null
            ? actor.id === instanceId
            : actor.id === clients[0]?.id;
        const visible = multiClientColumns || selected;
        const focused = multiClientColumns
          ? focusedClientId === actor.id
          : selected;
        const panel = (
          <ClientPlaygroundPanel
            actor={actor}
            session={session}
            snapshotEpoch={snapshotEpoch}
            reloadToken={session.revision}
            pane={resolvePlaygroundPane(panes, actor.id, 'client')}
            onPanePatch={(patch, mode) => onPanePatch(actor.id, patch, mode)}
          />
        );
        const body =
          clientColumnShell !== undefined ? (
            clientColumnShell({
              actor,
              focused,
              onActivate: () => onFocusedClientIdChange(actor.id),
              children: panel,
            })
          ) : (
            <DebuggerColumn key={actor.id}>{panel}</DebuggerColumn>
          );
        if (multiClientColumns) return body;
        return (
          <Box
            key={actor.id}
            sx={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              flexDirection: 'column',
              display: visible ? 'flex' : 'none',
            }}
          >
            {body}
          </Box>
        );
      })}
    </DebuggerColumns>
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
