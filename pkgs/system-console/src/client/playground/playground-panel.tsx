import {
  Box,
  CodeIcon,
  DatabaseIcon,
  PaintbrushIcon,
  ScrollTextIcon,
  TabStrip,
  type TabStripItem,
  TerminalIcon,
} from '@pkgs/ui';
import type { ReactNode } from 'react';

import type {
  PlaygroundActor,
  PlaygroundPubSubNode,
  PlaygroundRoomNode,
  PlaygroundSession,
  PlaygroundSqlNode,
  SystemConsolePorts,
} from '../../shared/ports';
import { PlaygroundCommandsPane } from './playground-commands-pane';
import { PlaygroundDbPane } from './playground-db-pane';
import { PlaygroundLogsPane } from './playground-logs-pane';
import { PlaygroundPubSubTopicsPane } from './playground-pubsub-topics-pane';
import { PlaygroundRoomDbPane } from './playground-room-db-pane';

const CLIENT_TABS = [
  { id: 'ui', label: 'UI', icon: PaintbrushIcon },
  { id: 'db', label: 'DB', icon: DatabaseIcon },
  { id: 'logs', label: 'Logs', icon: ScrollTextIcon },
] as const;

const SERVER_TABS = [
  { id: 'db', label: 'DB', icon: DatabaseIcon },
  { id: 'logs', label: 'Logs', icon: ScrollTextIcon },
  { id: 'commands', label: 'Commands', icon: TerminalIcon },
] as const;

const PUBSUB_TABS = [
  { id: 'logs', label: 'Logs', icon: ScrollTextIcon },
  { id: 'topics', label: 'Topics', icon: CodeIcon },
] as const;

const ROOM_TABS = [
  { id: 'db', label: 'DB', icon: DatabaseIcon },
  { id: 'logs', label: 'Logs', icon: ScrollTextIcon },
] as const;

type ClientTabId = (typeof CLIENT_TABS)[number]['id'];
type ServerTabId = (typeof SERVER_TABS)[number]['id'];
type PubSubTabId = (typeof PUBSUB_TABS)[number]['id'];
type RoomTabId = (typeof ROOM_TABS)[number]['id'];

function asClientTab(view: string): ClientTabId {
  return CLIENT_TABS.some((t) => t.id === view) ? (view as ClientTabId) : 'ui';
}

function asServerTab(view: string): ServerTabId {
  return SERVER_TABS.some((t) => t.id === view) ? (view as ServerTabId) : 'db';
}

function asPubSubTab(view: string): PubSubTabId {
  return PUBSUB_TABS.some((t) => t.id === view)
    ? (view as PubSubTabId)
    : 'logs';
}

function asRoomTab(view: string): RoomTabId {
  return ROOM_TABS.some((t) => t.id === view) ? (view as RoomTabId) : 'db';
}

export function ClientPlaygroundPanel<R>(props: {
  readonly title: string;
  readonly ProductApp: SystemConsolePorts<R>['ProductApp'];
  readonly actor: PlaygroundActor<R>;
  /** Bumps only on snapshot restore — remount ProductApp without room churn. */
  readonly snapshotEpoch?: number;
  readonly reloadToken?: number;
  readonly view: string;
  readonly onViewChange: (view: string) => void;
}) {
  const {
    title,
    ProductApp,
    actor,
    snapshotEpoch,
    reloadToken,
    view,
    onViewChange,
  } = props;
  const tab = asClientTab(view);
  const productKey = `${actor.id}:${snapshotEpoch ?? 0}`;

  return (
    <PanelShell
      accessibilityLabel={`${title} views`}
      items={[...CLIENT_TABS]}
      selectedId={tab}
      onSelect={onViewChange}
    >
      <Box
        sx={{
          ...uiBodySx,
          display: tab === 'ui' ? 'flex' : 'none',
          pointerEvents: tab === 'ui' ? 'auto' : 'none',
        }}
      >
        <ProductApp
          key={productKey}
          io={actor.io}
          resources={actor.resources}
          embedded
        />
      </Box>
      {tab === 'db' ? (
        <PlaygroundDbPane
          sqlClient={actor.sqlClient}
          {...(reloadToken !== undefined ? { reloadToken } : {})}
        />
      ) : null}
      {tab === 'logs' ? <PlaygroundLogsPane logs={actor.logs} /> : null}
    </PanelShell>
  );
}

export function ServerPlaygroundPanel<R>(props: {
  readonly session: PlaygroundSession<R>;
  readonly node: PlaygroundSqlNode;
  readonly view: string;
  readonly onViewChange: (view: string) => void;
}) {
  const { session, node, view, onViewChange } = props;
  const tab = asServerTab(view);

  return (
    <PanelShell
      accessibilityLabel="Server views"
      items={[...SERVER_TABS]}
      selectedId={tab}
      onSelect={onViewChange}
    >
      {tab === 'db' ? (
        <PlaygroundDbPane
          sqlClient={node.sqlClient}
          reloadToken={session.revision}
        />
      ) : null}
      {tab === 'logs' ? <PlaygroundLogsPane logs={node.logs} /> : null}
      {tab === 'commands' ? <PlaygroundCommandsPane session={session} /> : null}
    </PanelShell>
  );
}

export function PubSubPlaygroundPanel<R>(props: {
  readonly session: PlaygroundSession<R>;
  readonly pubsub: PlaygroundPubSubNode;
  readonly view: string;
  readonly onViewChange: (view: string) => void;
}) {
  const { session, pubsub, view, onViewChange } = props;
  const tab = asPubSubTab(view);

  return (
    <PanelShell
      accessibilityLabel="PubSub views"
      items={[...PUBSUB_TABS]}
      selectedId={tab}
      onSelect={onViewChange}
    >
      {tab === 'logs' ? <PlaygroundLogsPane logs={pubsub.logs} /> : null}
      {tab === 'topics' ? (
        <PlaygroundPubSubTopicsPane
          pubsub={pubsub}
          subscribe={session.subscribe}
        />
      ) : null}
    </PanelShell>
  );
}

export function RoomPlaygroundPanel<R>(props: {
  readonly session: PlaygroundSession<R>;
  readonly room: PlaygroundRoomNode;
  readonly view: string;
  readonly onViewChange: (view: string) => void;
}) {
  const { session, room, view, onViewChange } = props;
  const tab = asRoomTab(view);

  return (
    <PanelShell
      accessibilityLabel={`${room.id} views`}
      items={[...ROOM_TABS]}
      selectedId={tab}
      onSelect={onViewChange}
    >
      {tab === 'db' ? (
        <PlaygroundRoomDbPane room={room} subscribe={session.subscribe} />
      ) : null}
      {tab === 'logs' ? <PlaygroundLogsPane logs={room.logs} /> : null}
    </PanelShell>
  );
}

function PanelShell(props: {
  readonly accessibilityLabel: string;
  readonly items: readonly TabStripItem[];
  readonly selectedId: string;
  readonly onSelect: (id: string) => void;
  readonly children: ReactNode;
}) {
  return (
    <Box
      sx={{
        flex: 1,
        flexBasis: 0,
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        background: 'surface',
        borderRightWidth: 1,
        borderColor: 'border',
      }}
    >
      <TabStrip
        accessibilityLabel={props.accessibilityLabel}
        items={props.items}
        selectedId={props.selectedId}
        onSelect={props.onSelect}
      />
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {props.children}
      </Box>
    </Box>
  );
}

const uiBodySx = {
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
  position: 'relative',
  background: 'surface',
} as const;
