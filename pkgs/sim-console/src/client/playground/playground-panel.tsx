import { Box, TabStrip } from '@pkgs/ui';
import {
  coerceDebuggerView,
  type DebuggerViewId,
  defaultViewForKind,
  viewsForKind,
} from '../../shared/debugger-views';
import type {
  PlaygroundActor,
  PlaygroundPubSubNode,
  PlaygroundRoomNode,
  PlaygroundSession,
  PlaygroundSqlNode,
} from '../../shared/ports';
import type { PaneNavPatch, PaneNavValue } from '../debugger-chrome';
import { debuggerViewTabItem } from '../debugger-chrome';
import { PlaygroundCommandsPane } from './playground-commands-pane';
import { PlaygroundDbPane } from './playground-db-pane';
import { PlaygroundLogsPane } from './playground-logs-pane';
import { PlaygroundPubSubTopicsPane } from './playground-pubsub-topics-pane';
import { PlaygroundRoomDbPane } from './playground-room-db-pane';

const panelSx = {
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  overflow: 'hidden',
  background: 'surface',
  flexDirection: 'column',
} as const;

const uiBodySx = {
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
  position: 'relative',
  background: 'surface',
} as const;

const fillSx = {
  flex: 1,
  minHeight: 0,
  minWidth: 0,
} as const;

function hiddenWhen(active: boolean) {
  return {
    ...fillSx,
    display: active ? ('flex' as const) : ('none' as const),
    pointerEvents: active ? ('auto' as const) : ('none' as const),
  };
}

function resolvePane(
  pane: PaneNavValue | undefined,
  kind: 'client' | 'server' | 'events' | 'room'
): PaneNavValue {
  if (pane !== undefined) {
    return {
      view: coerceDebuggerView(kind, pane.view),
      table: pane.table,
    };
  }
  return { view: defaultViewForKind(kind), table: null };
}

export function ClientPlaygroundPanel(props: {
  readonly actor: PlaygroundActor;
  readonly snapshotEpoch?: number;
  readonly reloadToken?: number;
  readonly pane: PaneNavValue | undefined;
  readonly onPanePatch: (
    patch: PaneNavPatch,
    mode?: 'push' | 'replace'
  ) => void;
}) {
  const { actor, snapshotEpoch, reloadToken, onPanePatch } = props;
  const pane = resolvePane(props.pane, 'client');
  const tab = pane.view;
  const productKey = `${actor.id}:${snapshotEpoch ?? 0}`;
  const ActorApp = actor.App;
  const views = viewsForKind('client');

  return (
    <Box sx={panelSx} dataSet={{ debuggerClient: actor.address }}>
      <TabStrip
        accessibilityLabel="Client views"
        items={views.map((v) => debuggerViewTabItem(v))}
        selectedId={tab}
        onSelect={(id) => onPanePatch({ view: id })}
      />
      <Box
        sx={{
          ...uiBodySx,
          display: tab === 'ui' ? 'flex' : 'none',
          pointerEvents: tab === 'ui' ? 'auto' : 'none',
        }}
      >
        <ActorApp key={productKey} embedded />
      </Box>
      <Box sx={hiddenWhen(tab === 'db')}>
        <PlaygroundDbPane
          sqlClient={actor.sqlClient}
          active={tab === 'db'}
          selectedTable={pane.table}
          onSelectTable={(table) => onPanePatch({ table }, 'replace')}
          {...(reloadToken !== undefined ? { reloadToken } : {})}
        />
      </Box>
      <Box sx={hiddenWhen(tab === 'events')}>
        <PlaygroundLogsPane logs={actor.logs} />
      </Box>
    </Box>
  );
}

export function ServerPlaygroundPanel(props: {
  readonly session: PlaygroundSession;
  readonly node: PlaygroundSqlNode;
  readonly pane: PaneNavValue | undefined;
  readonly onPanePatch: (
    patch: PaneNavPatch,
    mode?: 'push' | 'replace'
  ) => void;
}) {
  const { session, node, onPanePatch } = props;
  const pane = resolvePane(props.pane, 'server');
  const tab = pane.view;
  return (
    <Box sx={panelSx}>
      <Box sx={hiddenWhen(tab === 'db')}>
        <PlaygroundDbPane
          sqlClient={node.sqlClient}
          active={tab === 'db'}
          selectedTable={pane.table}
          onSelectTable={(table) => onPanePatch({ table }, 'replace')}
          reloadToken={session.revision}
        />
      </Box>
      <Box sx={hiddenWhen(tab === 'events')}>
        <PlaygroundLogsPane logs={node.logs} />
      </Box>
      <Box sx={hiddenWhen(tab === 'commands')}>
        <PlaygroundCommandsPane session={session} />
      </Box>
    </Box>
  );
}

export function PubSubPlaygroundPanel(props: {
  readonly session: PlaygroundSession;
  readonly pubsub: PlaygroundPubSubNode;
  readonly pane: PaneNavValue | undefined;
}) {
  const { session, pubsub } = props;
  const pane = resolvePane(props.pane, 'events');
  const tab = pane.view;
  return (
    <Box sx={panelSx}>
      <Box sx={hiddenWhen(tab === 'events')}>
        <PlaygroundLogsPane logs={pubsub.logs} />
      </Box>
      <Box sx={hiddenWhen(tab === 'topics')}>
        <PlaygroundPubSubTopicsPane
          pubsub={pubsub}
          subscribe={session.subscribe}
        />
      </Box>
    </Box>
  );
}

export function RoomPlaygroundPanel(props: {
  readonly session: PlaygroundSession;
  readonly room: PlaygroundRoomNode;
  readonly pane: PaneNavValue | undefined;
}) {
  const { session, room } = props;
  const pane = resolvePane(props.pane, 'room');
  const tab = pane.view;
  return (
    <Box sx={panelSx}>
      <Box sx={hiddenWhen(tab === 'db')}>
        <PlaygroundRoomDbPane room={room} subscribe={session.subscribe} />
      </Box>
      <Box sx={hiddenWhen(tab === 'events')}>
        <PlaygroundLogsPane logs={room.logs} />
      </Box>
    </Box>
  );
}

export type { DebuggerViewId };
