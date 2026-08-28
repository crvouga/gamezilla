import { Box, EmptyState } from '@pkgs/ui';
import type { ReactNode } from 'react';
import {
  coerceDebuggerView,
  type DebuggerViewId,
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
import {
  ClientPlaygroundPanel,
  PubSubPlaygroundPanel,
  RoomPlaygroundPanel,
  ServerPlaygroundPanel,
} from './playground-panel';

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

export function PlaygroundKindPane(props: {
  readonly session: PlaygroundSession;
  readonly kind: SimChromeKind;
  readonly view: DebuggerViewId;
  readonly instanceId: string | null;
  readonly clients: readonly PlaygroundActor[];
  readonly snapshotEpoch: number;
  readonly focusedClientId: string | null;
  readonly onFocusedClientIdChange: (id: string | null) => void;
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
    view,
    instanceId,
    clients,
    snapshotEpoch,
    focusedClientId,
    onFocusedClientIdChange,
    onClientColumnsOutsidePointerDown,
    clientColumnShell,
  } = props;

  if (kind === 'client') {
    return (
      <ClientLiveColumns
        session={session}
        clients={clients}
        view={view}
        instanceId={instanceId}
        snapshotEpoch={snapshotEpoch}
        focusedClientId={focusedClientId}
        onFocusedClientIdChange={onFocusedClientIdChange}
        {...(onClientColumnsOutsidePointerDown !== undefined
          ? { onOutsidePointerDown: onClientColumnsOutsidePointerDown }
          : {})}
        {...(clientColumnShell !== undefined ? { clientColumnShell } : {})}
      />
    );
  }
  if (kind === 'server') {
    return (
      <ServerPlaygroundPanel
        session={session}
        node={session.server}
        view={view}
      />
    );
  }
  if (kind === 'events') {
    return (
      <PubSubPlaygroundPanel
        session={session}
        pubsub={session.pubsub}
        view={view}
      />
    );
  }
  const room = resolveRoom(session, instanceId);
  if (room === null) {
    return <EmptyKind body="No room instances in this session." />;
  }
  return <RoomPlaygroundPanel session={session} room={room} view={view} />;
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
  readonly view: DebuggerViewId;
  readonly instanceId: string | null;
  readonly snapshotEpoch: number;
  readonly focusedClientId: string | null;
  readonly onFocusedClientIdChange: (id: string | null) => void;
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
    view,
    instanceId,
    snapshotEpoch,
    focusedClientId,
    onFocusedClientIdChange,
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
            snapshotEpoch={snapshotEpoch}
            reloadToken={session.revision}
            view={view}
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
