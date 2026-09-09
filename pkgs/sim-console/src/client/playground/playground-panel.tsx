import { Box } from '@pkgs/ui';
import { Match, Show, Switch } from 'solid-js';
import {
  coerceDebuggerView,
  type DebuggerViewId,
  defaultViewForKind,
} from '../../shared/debugger-views';
import type {
  PlaygroundActor,
  PlaygroundPubSubNode,
  PlaygroundRoomNode,
  PlaygroundSession,
  PlaygroundSqlNode,
} from '../../shared/ports';
import type { PaneNavPatch, PaneNavValue } from '../debugger-chrome';
import { SqlNotebookPane } from '../sql-notebook/sql-notebook-pane';
import { ActorUrlFrame } from './actor-url-frame';
import { PlaygroundCommandsPane } from './playground-commands-pane';
import { PlaygroundLogsPane } from './playground-logs-pane';
import { PlaygroundPubSubTopicsPane } from './playground-pubsub-topics-pane';
import { PlaygroundRoomDbPane } from './playground-room-db-pane';
import { SolidActorHost } from './solid-actor-host';

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

function ActorView(props: { readonly actor: PlaygroundActor }) {
  return (
    <Switch>
      <Match when={props.actor.view.kind === 'url'}>
        <ActorUrlFrame
          title={props.actor.id}
          url={props.actor.view.kind === 'url' ? props.actor.view.url : ''}
        />
      </Match>
      <Match when={true}>
        <SolidActorHost
          title={props.actor.id}
          App={
            props.actor.view.kind === 'solid'
              ? props.actor.view.App
              : () => null
          }
        />
      </Match>
    </Switch>
  );
}

function resolvePane(
  pane: PaneNavValue | undefined,
  kind: 'client' | 'server' | 'events' | 'room'
): PaneNavValue {
  if (pane !== undefined) {
    return { view: coerceDebuggerView(kind, pane.view) };
  }
  return { view: defaultViewForKind(kind) };
}

export function ClientPlaygroundPanel(props: {
  readonly actor: PlaygroundActor;
  readonly session: PlaygroundSession;
  readonly snapshotEpoch?: number;
  readonly reloadToken?: number;
  readonly pane: PaneNavValue | undefined;
  readonly onPanePatch: (
    patch: PaneNavPatch,
    mode?: 'push' | 'replace'
  ) => void;
}) {
  void props.session;
  void props.reloadToken;
  void props.pane;
  void props.onPanePatch;
  const productKey = () => `${props.actor.id}:${props.snapshotEpoch ?? 0}`;
  void props.reloadToken;

  return (
    <Box sx={panelSx} dataSet={{ debuggerClient: props.actor.address }}>
      <Box sx={uiBodySx}>
        <Show when={productKey()} keyed>
          {(_key: string) => <ActorView actor={props.actor} />}
        </Show>
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
  const pane = () => resolvePane(props.pane, 'server');
  const tab = () => pane().view;
  return (
    <Box sx={panelSx}>
      <Box sx={hiddenWhen(tab() === 'db')}>
        <SqlNotebookPane
          sqlClient={props.node.sqlClient}
          nodeId={props.node.id}
          active={tab() === 'db'}
          reloadToken={props.session.revision}
          subscribeDomainWake={(listener) =>
            props.session.subscribeDomainWake(listener)
          }
        />
      </Box>
      <Box sx={hiddenWhen(tab() === 'events')}>
        <PlaygroundLogsPane logs={props.node.logs} />
      </Box>
      <Box sx={hiddenWhen(tab() === 'commands')}>
        <PlaygroundCommandsPane session={props.session} />
      </Box>
    </Box>
  );
}

export function PubSubPlaygroundPanel(props: {
  readonly session: PlaygroundSession;
  readonly pubsub: PlaygroundPubSubNode;
  readonly pane: PaneNavValue | undefined;
}) {
  const pane = () => resolvePane(props.pane, 'events');
  const tab = () => pane().view;
  return (
    <Box sx={panelSx}>
      <Box sx={hiddenWhen(tab() === 'events')}>
        <PlaygroundLogsPane logs={props.pubsub.logs} />
      </Box>
      <Box sx={hiddenWhen(tab() === 'topics')}>
        <PlaygroundPubSubTopicsPane
          pubsub={props.pubsub}
          subscribe={props.session.subscribe}
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
  const pane = () => resolvePane(props.pane, 'room');
  const tab = () => pane().view;
  return (
    <Box sx={panelSx}>
      <Box sx={hiddenWhen(tab() === 'db')}>
        <PlaygroundRoomDbPane
          room={props.room}
          subscribe={props.session.subscribe}
        />
      </Box>
      <Box sx={hiddenWhen(tab() === 'events')}>
        <PlaygroundLogsPane logs={props.room.logs} />
      </Box>
    </Box>
  );
}

export type { DebuggerViewId };
