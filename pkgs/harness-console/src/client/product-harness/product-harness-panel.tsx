import { Match, Show, Switch } from 'solid-js';
import {
  coerceDebuggerView,
  type DebuggerViewId,
  defaultViewForKind,
} from '../../shared/debugger-views';
import type {
  ProductHarnessActor,
  ProductHarnessLoadBalancerNode,
  ProductHarnessPubSubNode,
  ProductHarnessRoomNode,
  ProductHarnessSession,
  ProductHarnessSqlNode,
} from '../../shared/ports';
import type { PaneNavPatch, PaneNavValue } from '../debugger-chrome';
import { SqlNotebookPane } from '../sql-notebook/sql-notebook-pane';
import { ActorUrlFrame } from './actor-url-frame';
import { ProductHarnessCommandsPane } from './product-harness-commands-pane';
import { ProductHarnessLoadBalancerPane } from './product-harness-lb-pane';
import { ProductHarnessLogsPane } from './product-harness-logs-pane';
import { ProductHarnessPubSubTopicsPane } from './product-harness-pubsub-topics-pane';
import { ProductHarnessRoomDbPane } from './product-harness-room-db-pane';
import { SolidActorHost } from './solid-actor-host';

function hiddenWhen(active: boolean): string {
  return active ? 'flex' : 'none';
}

function ActorView(props: { readonly actor: ProductHarnessActor }) {
  return (
    <Switch>
      <Match when={props.actor.view.kind === 'url' ? props.actor.view : false}>
        {(view) => <ActorUrlFrame title={props.actor.id} url={view().url} />}
      </Match>
      <Match
        when={props.actor.view.kind === 'solid' ? props.actor.view : false}
      >
        {(view) => (
          <SolidActorHost
            title={props.actor.id}
            App={view().App}
            history={view().history}
          />
        )}
      </Match>
    </Switch>
  );
}

function resolvePane(
  pane: PaneNavValue | undefined,
  kind: 'client' | 'lb' | 'server' | 'events' | 'room'
): PaneNavValue {
  if (pane !== undefined) {
    return { view: coerceDebuggerView(kind, pane.view) };
  }
  return { view: defaultViewForKind(kind) };
}

export function ClientProductHarnessPanel(props: {
  readonly actor: ProductHarnessActor;
  readonly session: ProductHarnessSession;
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
      class="box flex-1 min-w-0 min-h-0 overflow-hidden flex-col bg-surface"
      data-debuggerClient={props.actor.address}
    >
      <div class="box flex-1 min-h-0 overflow-hidden relative bg-surface">
        <Show when={productKey()} keyed>
          {(_key: string) => <ActorView actor={props.actor} />}
        </Show>
      </div>
    </div>
  );
}

export function ServerProductHarnessPanel(props: {
  readonly session: ProductHarnessSession;
  readonly node: ProductHarnessSqlNode;
  readonly pane: PaneNavValue | undefined;
  readonly onPanePatch: (
    patch: PaneNavPatch,
    mode?: 'push' | 'replace'
  ) => void;
}) {
  const pane = () => resolvePane(props.pane, 'server');
  const tab = () => pane().view;
  return (
    <div class="box flex-1 min-w-0 min-h-0 overflow-hidden flex-col bg-background">
      <div
        class="box flex-1 min-h-0 min-w-0 bg-background"
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
        class="box flex-1 min-h-0 min-w-0 bg-background"
        style={{ display: hiddenWhen(tab() === 'events') }}
      >
        <ProductHarnessLogsPane logs={props.node.logs} />
      </div>
      <div
        class="box flex-1 min-h-0 min-w-0 bg-background"
        style={{ display: hiddenWhen(tab() === 'commands') }}
      >
        <ProductHarnessCommandsPane session={props.session} />
      </div>
    </div>
  );
}

export function LoadBalancerProductHarnessPanel(props: {
  readonly session: ProductHarnessSession;
  readonly loadBalancer: ProductHarnessLoadBalancerNode;
  readonly pane: PaneNavValue | undefined;
}) {
  const pane = () => resolvePane(props.pane, 'lb');
  const tab = () => pane().view;
  return (
    <div class="box flex-1 min-w-0 min-h-0 overflow-hidden flex-col bg-background">
      <div
        class="box flex-1 min-h-0 min-w-0 bg-background"
        style={{ display: hiddenWhen(tab() === 'routes') }}
      >
        <ProductHarnessLoadBalancerPane
          loadBalancer={props.loadBalancer}
          subscribe={props.session.subscribe}
        />
      </div>
      <div
        class="box flex-1 min-h-0 min-w-0 bg-background"
        style={{ display: hiddenWhen(tab() === 'events') }}
      >
        <ProductHarnessLogsPane logs={props.loadBalancer.logs} />
      </div>
    </div>
  );
}

export function PubSubProductHarnessPanel(props: {
  readonly session: ProductHarnessSession;
  readonly pubsub: ProductHarnessPubSubNode;
  readonly pane: PaneNavValue | undefined;
}) {
  const pane = () => resolvePane(props.pane, 'events');
  const tab = () => pane().view;
  return (
    <div class="box flex-1 min-w-0 min-h-0 overflow-hidden flex-col bg-background">
      <div
        class="box flex-1 min-h-0 min-w-0 bg-background"
        style={{ display: hiddenWhen(tab() === 'events') }}
      >
        <ProductHarnessLogsPane logs={props.pubsub.logs} />
      </div>
      <div
        class="box flex-1 min-h-0 min-w-0 bg-background"
        style={{ display: hiddenWhen(tab() === 'topics') }}
      >
        <ProductHarnessPubSubTopicsPane
          pubsub={props.pubsub}
          subscribe={props.session.subscribe}
        />
      </div>
    </div>
  );
}

export function RoomProductHarnessPanel(props: {
  readonly session: ProductHarnessSession;
  readonly room: ProductHarnessRoomNode;
  readonly pane: PaneNavValue | undefined;
}) {
  const pane = () => resolvePane(props.pane, 'room');
  const tab = () => pane().view;
  return (
    <div class="box flex-1 min-w-0 min-h-0 overflow-hidden flex-col bg-background">
      <div
        class="box flex-1 min-h-0 min-w-0 bg-background"
        style={{ display: hiddenWhen(tab() === 'db') }}
      >
        <ProductHarnessRoomDbPane
          room={props.room}
          subscribe={props.session.subscribe}
        />
      </div>
      <div
        class="box flex-1 min-h-0 min-w-0 bg-background"
        style={{ display: hiddenWhen(tab() === 'events') }}
      >
        <ProductHarnessLogsPane logs={props.room.logs} />
      </div>
    </div>
  );
}

export type { DebuggerViewId };
