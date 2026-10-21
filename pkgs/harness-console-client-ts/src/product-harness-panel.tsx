import {
  coerceDebuggerView,
  defaultViewForKind,
} from '@pkgs/harness-console-shared-ts/debugger-views';
import type {
  ProductHarnessActor,
  ProductHarnessLoadBalancerNode,
  ProductHarnessPubSubNode,
  ProductHarnessRoomNode,
  ProductHarnessSession,
  ProductHarnessSqlNode,
} from '@pkgs/harness-console-shared-ts/ports';
import { EmbeddedFrame } from '@pkgs/ui-root-client-ts/embedded-frame';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import { type JSX, Match, Show, Switch } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { PaneNavPatch, PaneNavValue } from './debugger-chrome';
import { ProductHarnessCommandsPane } from './product-harness-commands-pane';
import { ProductHarnessLoadBalancerPane } from './product-harness-lb-pane';
import { ProductHarnessLogsPane } from './product-harness-logs-pane';
import { ProductHarnessPubSubTopicsPane } from './product-harness-pubsub-topics-pane';
import { ProductHarnessRoomDbPane } from './product-harness-room-db-pane';
import { SqlNotebookPane } from './sql-notebook-pane';

/** One view of a node: kept mounted, shown only while its tab is picked. */
function ViewSlot(props: {
  readonly active: boolean;
  readonly children: JSX.Element;
}) {
  return (
    <StackVertical grow hidden={!props.active}>
      {props.children}
    </StackVertical>
  );
}

/** Every node panel: fills its column on the canvas fill and clips. */
function NodePanel(props: { readonly children: JSX.Element }) {
  return (
    <Surface tone="background" grow overflow="hidden">
      {props.children}
    </Surface>
  );
}

function ActorView(props: { readonly actor: ProductHarnessActor }) {
  return (
    <Switch>
      <Match when={props.actor.view.kind === 'url' ? props.actor.view : false}>
        {(view) => <EmbeddedFrame title={props.actor.id} src={view().url} />}
      </Match>
      <Match
        when={props.actor.view.kind === 'solid' ? props.actor.view : false}
      >
        {(view) => (
          // `history` is owned by the session actor so the MemoryRouter
          // location survives `snapshotEpoch` remounts.
          <EmbeddedFrame title={props.actor.id}>
            <Dynamic
              component={view().App}
              embedded={true}
              history={view().history}
            />
          </EmbeddedFrame>
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
    <Surface
      tone="surface"
      grow
      overflow="hidden"
      dataSet={{ 'debugger-client': props.actor.address }}
    >
      <Show when={productKey()} keyed>
        {(_key: string) => <ActorView actor={props.actor} />}
      </Show>
    </Surface>
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
    <NodePanel>
      <ViewSlot active={tab() === 'db'}>
        <SqlNotebookPane
          sqlClient={props.node.sqlClient}
          nodeId={props.node.id}
          active={tab() === 'db'}
          reloadToken={props.session.revision}
          subscribeDomainWake={(listener) =>
            props.session.subscribeDomainWake(listener)
          }
        />
      </ViewSlot>
      <ViewSlot active={tab() === 'events'}>
        <ProductHarnessLogsPane logs={props.node.logs} />
      </ViewSlot>
      <ViewSlot active={tab() === 'commands'}>
        <ProductHarnessCommandsPane session={props.session} />
      </ViewSlot>
    </NodePanel>
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
    <NodePanel>
      <ViewSlot active={tab() === 'routes'}>
        <ProductHarnessLoadBalancerPane
          loadBalancer={props.loadBalancer}
          subscribe={props.session.subscribe}
        />
      </ViewSlot>
      <ViewSlot active={tab() === 'events'}>
        <ProductHarnessLogsPane logs={props.loadBalancer.logs} />
      </ViewSlot>
    </NodePanel>
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
    <NodePanel>
      <ViewSlot active={tab() === 'events'}>
        <ProductHarnessLogsPane logs={props.pubsub.logs} />
      </ViewSlot>
      <ViewSlot active={tab() === 'topics'}>
        <ProductHarnessPubSubTopicsPane
          pubsub={props.pubsub}
          subscribe={props.session.subscribe}
        />
      </ViewSlot>
    </NodePanel>
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
    <NodePanel>
      <ViewSlot active={tab() === 'db'}>
        <ProductHarnessRoomDbPane
          room={props.room}
          subscribe={props.session.subscribe}
        />
      </ViewSlot>
      <ViewSlot active={tab() === 'events'}>
        <ProductHarnessLogsPane logs={props.room.logs} />
      </ViewSlot>
    </NodePanel>
  );
}
