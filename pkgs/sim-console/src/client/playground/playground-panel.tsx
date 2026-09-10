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

function hiddenWhen(active: boolean): string {
  return active ? 'flex' : 'none';
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
    <div
      class="box flex-1 min-w-[0] min-h-[0] overflow-hidden flex-col bg-surface"
      data-debuggerClient={props.actor.address}
    >
      <div class="box flex-1 min-h-[0] overflow-hidden relative bg-surface">
        <Show when={productKey()} keyed>
          {(_key: string) => <ActorView actor={props.actor} />}
        </Show>
      </div>
    </div>
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
    <div class="box flex-1 min-w-[0] min-h-[0] overflow-hidden flex-col bg-background">
      <div
        class="box flex-1 min-h-[0] min-w-[0] bg-background"
        style={{ display: hiddenWhen(tab() === 'db') }}
      >
        <SqlNotebookPane
          sqlClient={props.node.sqlClient}
          nodeId={props.node.id}
          active={tab() === 'db'}
          reloadToken={props.session.revision}
          subscribeDomainWake={(listener) =>
            props.session.subscribeDomainWake(listener)
          }
        />
      </div>
      <div
        class="box flex-1 min-h-[0] min-w-[0] bg-background"
        style={{ display: hiddenWhen(tab() === 'events') }}
      >
        <PlaygroundLogsPane logs={props.node.logs} />
      </div>
      <div
        class="box flex-1 min-h-[0] min-w-[0] bg-background"
        style={{ display: hiddenWhen(tab() === 'commands') }}
      >
        <PlaygroundCommandsPane session={props.session} />
      </div>
    </div>
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
    <div class="box flex-1 min-w-[0] min-h-[0] overflow-hidden flex-col bg-background">
      <div
        class="box flex-1 min-h-[0] min-w-[0] bg-background"
        style={{ display: hiddenWhen(tab() === 'events') }}
      >
        <PlaygroundLogsPane logs={props.pubsub.logs} />
      </div>
      <div
        class="box flex-1 min-h-[0] min-w-[0] bg-background"
        style={{ display: hiddenWhen(tab() === 'topics') }}
      >
        <PlaygroundPubSubTopicsPane
          pubsub={props.pubsub}
          subscribe={props.session.subscribe}
        />
      </div>
    </div>
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
    <div class="box flex-1 min-w-[0] min-h-[0] overflow-hidden flex-col bg-background">
      <div
        class="box flex-1 min-h-[0] min-w-[0] bg-background"
        style={{ display: hiddenWhen(tab() === 'db') }}
      >
        <PlaygroundRoomDbPane
          room={props.room}
          subscribe={props.session.subscribe}
        />
      </div>
      <div
        class="box flex-1 min-h-[0] min-w-[0] bg-background"
        style={{ display: hiddenWhen(tab() === 'events') }}
      >
        <PlaygroundLogsPane logs={props.room.logs} />
      </div>
    </div>
  );
}

export type { DebuggerViewId };
