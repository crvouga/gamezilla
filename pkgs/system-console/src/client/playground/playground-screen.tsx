import {
  Box,
  CommandPalette,
  CommandRegistryProvider,
  DoorOpenIcon,
  EmptyState,
  ErrorState,
  LoadingState,
  MonitorIcon,
  OverlayPortalProvider,
  RadioIcon,
  RegisterCommand,
  ServerIcon,
  SurfaceStackProvider,
  TabStrip,
} from '@pkgs/ui';
import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';

import type {
  PlaygroundPaletteCommand,
  PlaygroundSession,
  SystemConsolePorts,
} from '../../shared/ports';
import {
  ClientPlaygroundPanel,
  PubSubPlaygroundPanel,
  RoomPlaygroundPanel,
  ServerPlaygroundPanel,
} from './playground-panel';
import { PlaygroundSnapshotChrome } from './playground-snapshot-chrome';
import type { PlaygroundSessionState } from './use-playground-session';

const KIND_TABS = [
  { id: 'client', label: 'Client', icon: MonitorIcon },
  { id: 'server', label: 'Server', icon: ServerIcon },
  { id: 'pubsub', label: 'PubSub', icon: RadioIcon },
  { id: 'room', label: 'Room', icon: DoorOpenIcon },
] as const;

export type PlaygroundKindId = (typeof KIND_TABS)[number]['id'];

export function PlaygroundScreen<R>(props: {
  readonly ports: SystemConsolePorts<R>;
  readonly state: PlaygroundSessionState<R>;
  readonly kind: PlaygroundKindId;
  readonly view: string;
  readonly clientViews: Readonly<Record<string, string>>;
  readonly onKindChange: (kind: PlaygroundKindId) => void;
  readonly onViewChange: (view: string) => void;
  readonly onClientViewChange: (clientId: string, view: string) => void;
}) {
  const {
    ports,
    state,
    kind,
    view,
    clientViews,
    onKindChange,
    onViewChange,
    onClientViewChange,
  } = props;

  if (state.status === 'error') {
    return (
      <Box sx={centerSx}>
        <ErrorState title="Failed to boot playground" body={state.error} />
      </Box>
    );
  }
  if (state.status !== 'ready') {
    return (
      <Box sx={centerSx}>
        <LoadingState caption="Booting playground…" />
      </Box>
    );
  }

  return (
    <OverlayPortalProvider>
      <SurfaceStackProvider>
        <CommandRegistryProvider>
          <ReadyPlaygroundScreen
            ports={ports}
            session={state.session}
            kind={kind}
            view={view}
            clientViews={clientViews}
            onKindChange={onKindChange}
            onViewChange={onViewChange}
            onClientViewChange={onClientViewChange}
          />
          <CommandPalette />
        </CommandRegistryProvider>
      </SurfaceStackProvider>
    </OverlayPortalProvider>
  );
}

function ReadyPlaygroundScreen<R>(props: {
  readonly ports: SystemConsolePorts<R>;
  readonly session: PlaygroundSession<R>;
  readonly kind: PlaygroundKindId;
  readonly view: string;
  readonly clientViews: Readonly<Record<string, string>>;
  readonly onKindChange: (kind: PlaygroundKindId) => void;
  readonly onViewChange: (view: string) => void;
  readonly onClientViewChange: (clientId: string, view: string) => void;
}) {
  const {
    ports,
    session,
    kind,
    view,
    clientViews,
    onKindChange,
    onViewChange,
    onClientViewChange,
  } = props;
  const tick = useSyncExternalStore(
    session.subscribe,
    () => session.revision,
    () => session.revision
  );
  void tick;
  const roomIds = [...session.rooms.keys()];
  const [roomId, setRoomId] = useState<string | null>(roomIds[0] ?? null);

  useEffect(() => {
    if (roomId !== null && session.rooms.has(roomId)) return;
    setRoomId(roomIds[0] ?? null);
  }, [roomId, roomIds, session.rooms]);

  const paletteCommands = useMemo(
    () => session.listPaletteCommands(),
    [session, tick]
  );
  const clients = session.snapshotRestoring
    ? []
    : [...session.clients.values()];
  const snapshotEpoch = session.snapshotEpoch;

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        background: 'background',
        overflow: 'hidden',
      }}
    >
      <PlaygroundPaletteRegistrations commands={paletteCommands} />
      <TabStrip
        accessibilityLabel="Playground kinds"
        items={[...KIND_TABS]}
        selectedId={kind}
        onSelect={(id) => onKindChange(id as PlaygroundKindId)}
        keyboardScope
        trailing={<PlaygroundSnapshotChrome session={session} />}
      />
      {kind === 'room' ? (
        <TabStrip
          accessibilityLabel="Rooms"
          items={roomIds.map((id) => ({ id, label: id }))}
          selectedId={roomId}
          onSelect={setRoomId}
        />
      ) : null}
      <KindPanels
        ports={ports}
        session={session}
        kind={kind}
        view={view}
        clientViews={clientViews}
        onViewChange={onViewChange}
        onClientViewChange={onClientViewChange}
        selectedRoomId={roomId}
        clients={clients}
        snapshotEpoch={snapshotEpoch}
      />
    </Box>
  );
}

function PlaygroundPaletteRegistrations(props: {
  readonly commands: readonly PlaygroundPaletteCommand[];
}) {
  return (
    <>
      {props.commands.map((cmd) => (
        <RegisterCommand
          key={cmd.id}
          id={cmd.id}
          title={cmd.title}
          {...(cmd.subtitle !== undefined ? { subtitle: cmd.subtitle } : {})}
          {...(cmd.category !== undefined ? { category: cmd.category } : {})}
          {...(cmd.keywords !== undefined
            ? { keywords: [...cmd.keywords] }
            : {})}
          run={cmd.run}
        />
      ))}
    </>
  );
}

function KindPanels<R>(props: {
  readonly ports: SystemConsolePorts<R>;
  readonly session: PlaygroundSession<R>;
  readonly kind: PlaygroundKindId;
  readonly view: string;
  readonly clientViews: Readonly<Record<string, string>>;
  readonly onViewChange: (view: string) => void;
  readonly onClientViewChange: (clientId: string, view: string) => void;
  readonly selectedRoomId: string | null;
  readonly clients: readonly import('../../shared/ports').PlaygroundActor<R>[];
  readonly snapshotEpoch: number;
}) {
  const {
    ports,
    session,
    kind,
    view,
    clientViews,
    onViewChange,
    onClientViewChange,
    selectedRoomId,
    clients,
    snapshotEpoch,
  } = props;
  const selectedRoom =
    selectedRoomId !== null ? session.rooms.get(selectedRoomId) : undefined;

  return (
    <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
      <KindSlot active={kind === 'client'}>
        <ClientColumns
          ports={ports}
          session={session}
          clients={clients}
          snapshotEpoch={snapshotEpoch}
          clientViews={clientViews}
          onClientViewChange={onClientViewChange}
        />
      </KindSlot>
      <KindSlot active={kind === 'server'}>
        <ServerPlaygroundPanel
          session={session}
          node={session.server}
          view={view}
          onViewChange={onViewChange}
        />
      </KindSlot>
      <KindSlot active={kind === 'pubsub'}>
        <PubSubPlaygroundPanel
          session={session}
          pubsub={session.pubsub}
          view={view}
          onViewChange={onViewChange}
        />
      </KindSlot>
      <KindSlot active={kind === 'room'}>
        {selectedRoom !== undefined ? (
          <RoomPlaygroundPanel
            session={session}
            room={selectedRoom}
            view={view}
            onViewChange={onViewChange}
          />
        ) : (
          <EmptyKind body="Open a space in a client to spawn a room." />
        )}
      </KindSlot>
    </Box>
  );
}

function ClientColumns<R>(props: {
  readonly ports: SystemConsolePorts<R>;
  readonly session: PlaygroundSession<R>;
  readonly clients: readonly import('../../shared/ports').PlaygroundActor<R>[];
  readonly snapshotEpoch: number;
  readonly clientViews: Readonly<Record<string, string>>;
  readonly onClientViewChange: (clientId: string, view: string) => void;
}) {
  const {
    ports,
    session,
    clients,
    snapshotEpoch,
    clientViews,
    onClientViewChange,
  } = props;
  if (clients.length === 0) {
    return <EmptyKind body="No clients in this session." />;
  }
  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'stretch',
        overflow: 'hidden',
      }}
    >
      {clients.map((actor) => (
        <ClientPlaygroundPanel
          key={`${actor.id}:${snapshotEpoch}`}
          title={actor.id}
          ProductApp={ports.ProductApp}
          actor={actor}
          snapshotEpoch={snapshotEpoch}
          reloadToken={session.revision}
          view={clientViews[actor.id] ?? 'ui'}
          onViewChange={(v) => onClientViewChange(actor.id, v)}
        />
      ))}
    </Box>
  );
}

function KindSlot(props: {
  readonly active: boolean;
  readonly children: ReactNode;
}) {
  return (
    <Box
      sx={{
        absoluteFill: true,
        display: props.active ? 'flex' : 'none',
        pointerEvents: props.active ? 'auto' : 'none',
        overflow: 'hidden',
      }}
    >
      {props.children}
    </Box>
  );
}

function EmptyKind(props: { readonly body: string }) {
  return (
    <Box sx={centerSx}>
      <EmptyState
        variant="compact"
        title="Nothing selected"
        body={props.body}
      />
    </Box>
  );
}

const centerSx = {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  background: 'background',
  padding: 4,
} as const;
