import {
  Box,
  CodeIcon,
  DatabaseIcon,
  PaintbrushIcon,
  Pressable,
  ScrollTextIcon,
  TabStrip,
  type TabStripItem,
  TerminalIcon,
  Text,
} from '@pkgs/ui';
import { type ReactNode, useState } from 'react';

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

export function ClientPlaygroundPanel<R>(props: {
  readonly title: string;
  readonly ProductApp: SystemConsolePorts<R>['ProductApp'];
  readonly actor: PlaygroundActor<R>;
  /** Bumps only on snapshot restore — remount ProductApp without room churn. */
  readonly snapshotEpoch?: number;
  readonly reloadToken?: number;
  readonly onClose?: () => void;
}) {
  const { title, ProductApp, actor, snapshotEpoch, reloadToken, onClose } =
    props;
  const [tab, setTab] = useState<ClientTabId>('ui');
  const productKey = `${actor.id}:${snapshotEpoch ?? 0}`;

  return (
    <PanelShell
      title={title}
      accessibilityLabel={`${title} views`}
      items={[...CLIENT_TABS]}
      selectedId={tab}
      onSelect={(id) => setTab(id as ClientTabId)}
      {...(onClose !== undefined ? { onClose } : {})}
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
}) {
  const { session, node } = props;
  const [tab, setTab] = useState<ServerTabId>('db');

  return (
    <PanelShell
      title="Server"
      accessibilityLabel="Server views"
      items={[...SERVER_TABS]}
      selectedId={tab}
      onSelect={(id) => setTab(id as ServerTabId)}
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
}) {
  const { session, pubsub } = props;
  const [tab, setTab] = useState<PubSubTabId>('logs');

  return (
    <PanelShell
      title="PubSub"
      accessibilityLabel="PubSub views"
      items={[...PUBSUB_TABS]}
      selectedId={tab}
      onSelect={(id) => setTab(id as PubSubTabId)}
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
}) {
  const { session, room } = props;
  const [tab, setTab] = useState<RoomTabId>('db');

  return (
    <PanelShell
      title={room.id}
      accessibilityLabel={`${room.id} views`}
      items={[...ROOM_TABS]}
      selectedId={tab}
      onSelect={(id) => setTab(id as RoomTabId)}
    >
      {tab === 'db' ? (
        <PlaygroundRoomDbPane room={room} subscribe={session.subscribe} />
      ) : null}
      {tab === 'logs' ? <PlaygroundLogsPane logs={room.logs} /> : null}
    </PanelShell>
  );
}

function PanelShell(props: {
  readonly title: string;
  readonly accessibilityLabel: string;
  readonly items: readonly TabStripItem[];
  readonly selectedId: string;
  readonly onSelect: (id: string) => void;
  readonly onClose?: () => void;
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
        {...(props.onClose !== undefined
          ? {
              trailing: (
                <Pressable
                  accessibilityLabel={`Close ${props.title}`}
                  onPress={props.onClose}
                  sx={{ paddingHorizontal: 2, paddingVertical: 1 }}
                >
                  <Text
                    label="×"
                    sx={{ color: 'textSecondary', fontSize: 16 }}
                  />
                </Pressable>
              ),
            }
          : {})}
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
