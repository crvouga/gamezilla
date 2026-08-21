import {
  Box,
  CommandPalette,
  CommandRegistryProvider,
  EmptyState,
  ErrorState,
  LoadingState,
  OverlayPortalProvider,
  RegisterCommand,
  SurfaceStackProvider,
} from '@pkgs/ui';
import { useMemo, useSyncExternalStore } from 'react';
import { coerceDebuggerView, viewsForKind } from '../../shared/debugger-views';
import type {
  PlaygroundPaletteCommand,
  PlaygroundSession,
} from '../../shared/ports';
import type { SimChromeKind } from '../../shared/sim-node';
import { DebuggerColumn, DebuggerColumns } from '../debugger/debugger-columns';
import { DebuggerShell } from '../debugger/debugger-shell';
import type { DebuggerChromeNav } from '../debugger-chrome';
import {
  ClientPlaygroundPanel,
  PubSubPlaygroundPanel,
  RoomPlaygroundPanel,
  ServerPlaygroundPanel,
} from './playground-panel';
import { PlaygroundSnapshotChrome } from './playground-snapshot-chrome';
import type { PlaygroundSessionState } from './use-playground-session';

export type { SimChromeKind as PlaygroundKindId } from '../../shared/sim-node';

export function PlaygroundScreen(props: {
  readonly state: PlaygroundSessionState;
  readonly kind: SimChromeKind;
  readonly instance: string;
  readonly view: string;
  readonly onKindChange: (kind: SimChromeKind) => void;
  readonly onInstanceChange: (instance: string) => void;
  readonly onViewChange: (view: string) => void;
}) {
  const { state, kind, instance, view } = props;

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
            session={state.session}
            chrome={{
              kind,
              instance,
              view,
              onKindChange: props.onKindChange,
              onInstanceChange: props.onInstanceChange,
              onViewChange: props.onViewChange,
            }}
          />
          <CommandPalette />
        </CommandRegistryProvider>
      </SurfaceStackProvider>
    </OverlayPortalProvider>
  );
}

function ReadyPlaygroundScreen(props: {
  readonly session: PlaygroundSession;
  readonly chrome: DebuggerChromeNav;
}) {
  const { session, chrome } = props;
  const tick = useSyncExternalStore(
    session.subscribe,
    () => session.revision,
    () => session.revision
  );
  void tick;
  const clients = session.snapshotRestoring
    ? []
    : [...session.clients.values()];
  const roomIds = [...session.rooms.keys()];
  const instances = instancesForPlayground(chrome.kind, clients, roomIds);
  const instanceId =
    instances.find((n) => n.id === chrome.instance)?.id ??
    instances[0]?.id ??
    '';
  const view = coerceDebuggerView(chrome.kind, chrome.view);
  const views = viewsForKind(chrome.kind, {
    hasCommands: true,
    hasTopics: true,
  });
  const paletteCommands = useMemo(
    () => session.listPaletteCommands(),
    [session, tick]
  );
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
      <DebuggerShell
        showPlayer={false}
        frames={[]}
        selectedFrameIndex={0}
        onSelectFrame={() => undefined}
        kindTrailing={<PlaygroundSnapshotChrome session={session} />}
        kind={chrome.kind}
        onKindChange={chrome.onKindChange}
        instances={instances}
        instanceId={instanceId.length > 0 ? instanceId : null}
        onInstanceChange={chrome.onInstanceChange}
        views={views}
        view={view}
        onViewChange={(next) => chrome.onViewChange(next)}
      >
        <LiveKindPane
          session={session}
          kind={chrome.kind}
          view={view}
          instanceId={instanceId}
          clients={clients}
          snapshotEpoch={snapshotEpoch}
        />
      </DebuggerShell>
    </Box>
  );
}

function instancesForPlayground(
  kind: SimChromeKind,
  clients: readonly import('../../shared/ports').PlaygroundActor[],
  roomIds: readonly string[]
): readonly { readonly id: string; readonly kind: string }[] {
  if (kind === 'client') {
    return clients.map((actor) => ({ id: actor.id, kind: 'client' }));
  }
  if (kind === 'room') {
    return roomIds.map((id) => ({ id, kind: 'room' }));
  }
  return [];
}

function LiveKindPane(props: {
  readonly session: PlaygroundSession;
  readonly kind: SimChromeKind;
  readonly view: string;
  readonly instanceId: string;
  readonly clients: readonly import('../../shared/ports').PlaygroundActor[];
  readonly snapshotEpoch: number;
}) {
  const { session, kind, view, instanceId, clients, snapshotEpoch } = props;
  if (kind === 'client') {
    return (
      <ClientLiveColumns
        session={session}
        clients={clients}
        view={view}
        snapshotEpoch={snapshotEpoch}
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
  const room = session.rooms.get(instanceId);
  if (room === undefined) {
    return <EmptyKind body="Open a space in a client to spawn a room." />;
  }
  return <RoomPlaygroundPanel session={session} room={room} view={view} />;
}

function ClientLiveColumns(props: {
  readonly session: PlaygroundSession;
  readonly clients: readonly import('../../shared/ports').PlaygroundActor[];
  readonly view: string;
  readonly snapshotEpoch: number;
}) {
  const { session, clients, view, snapshotEpoch } = props;
  if (clients.length === 0) {
    return <EmptyKind body="No clients in this session." />;
  }
  return (
    <DebuggerColumns>
      {clients.map((actor) => (
        <DebuggerColumn key={actor.id}>
          <ClientPlaygroundPanel
            actor={actor}
            snapshotEpoch={snapshotEpoch}
            reloadToken={session.revision}
            view={view}
          />
        </DebuggerColumn>
      ))}
    </DebuggerColumns>
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
