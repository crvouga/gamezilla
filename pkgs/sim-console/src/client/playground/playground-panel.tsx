import { Box } from '@pkgs/ui';
import { aliasDebuggerView } from '../../shared/debugger-views';
import type {
  PlaygroundActor,
  PlaygroundPubSubNode,
  PlaygroundRoomNode,
  PlaygroundSession,
  PlaygroundSqlNode,
} from '../../shared/ports';
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
} as const;

const uiBodySx = {
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
  position: 'relative',
  background: 'surface',
} as const;

export function ClientPlaygroundPanel(props: {
  readonly actor: PlaygroundActor;
  readonly snapshotEpoch?: number;
  readonly reloadToken?: number;
  readonly view: string;
}) {
  const { actor, snapshotEpoch, reloadToken, view } = props;
  const tab = aliasDebuggerView(view);
  const productKey = `${actor.id}:${snapshotEpoch ?? 0}`;
  const ActorApp = actor.App;

  return (
    <Box sx={panelSx} dataSet={{ debuggerClient: actor.address }}>
      <Box
        sx={{
          ...uiBodySx,
          display: tab === 'ui' ? 'flex' : 'none',
          pointerEvents: tab === 'ui' ? 'auto' : 'none',
        }}
      >
        <ActorApp key={productKey} embedded />
      </Box>
      {tab === 'db' ? (
        <PlaygroundDbPane
          sqlClient={actor.sqlClient}
          {...(reloadToken !== undefined ? { reloadToken } : {})}
        />
      ) : null}
      {tab === 'events' ? <PlaygroundLogsPane logs={actor.logs} /> : null}
    </Box>
  );
}

export function ServerPlaygroundPanel(props: {
  readonly session: PlaygroundSession;
  readonly node: PlaygroundSqlNode;
  readonly view: string;
}) {
  const { session, node, view } = props;
  const tab = aliasDebuggerView(view);
  return (
    <Box sx={panelSx}>
      {tab === 'db' ? (
        <PlaygroundDbPane
          sqlClient={node.sqlClient}
          reloadToken={session.revision}
        />
      ) : null}
      {tab === 'events' ? <PlaygroundLogsPane logs={node.logs} /> : null}
      {tab === 'commands' ? <PlaygroundCommandsPane session={session} /> : null}
    </Box>
  );
}

export function PubSubPlaygroundPanel(props: {
  readonly session: PlaygroundSession;
  readonly pubsub: PlaygroundPubSubNode;
  readonly view: string;
}) {
  const { session, pubsub, view } = props;
  const tab = aliasDebuggerView(view);
  return (
    <Box sx={panelSx}>
      {tab === 'events' ? <PlaygroundLogsPane logs={pubsub.logs} /> : null}
      {tab === 'topics' ? (
        <PlaygroundPubSubTopicsPane
          pubsub={pubsub}
          subscribe={session.subscribe}
        />
      ) : null}
    </Box>
  );
}

export function RoomPlaygroundPanel(props: {
  readonly session: PlaygroundSession;
  readonly room: PlaygroundRoomNode;
  readonly view: string;
}) {
  const { session, room, view } = props;
  const tab = aliasDebuggerView(view);
  return (
    <Box sx={panelSx}>
      {tab === 'db' ? (
        <PlaygroundRoomDbPane room={room} subscribe={session.subscribe} />
      ) : null}
      {tab === 'events' ? <PlaygroundLogsPane logs={room.logs} /> : null}
    </Box>
  );
}
