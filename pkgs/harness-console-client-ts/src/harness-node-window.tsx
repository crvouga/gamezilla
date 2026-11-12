import type { DebuggerViewId } from '@pkgs/harness-console-shared-ts/debugger-views';
import {
  coerceDebuggerView,
  viewsForKind,
} from '@pkgs/harness-console-shared-ts/debugger-views';
import type { HarnessPanelRef } from '@pkgs/harness-console-shared-ts/harness-windows';
import type { ProductHarnessSession } from '@pkgs/harness-console-shared-ts/ports';
import { TabStrip } from '@pkgs/ui-devtools-client-ts/tab-strip';
import type { WindowPanel } from '@pkgs/ui-devtools-client-ts/window-manager-types';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { KeyboardShortcutScope } from '@pkgs/ui-root-client-ts/keyboard-shortcut-scope';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import {
  type Accessor,
  createMemo,
  type JSX,
  Match,
  Show,
  Switch,
} from 'solid-js';
import type {
  HarnessConsoleNav,
  PaneNavHistoryMode,
  PaneNavPatch,
  PaneNavValue,
} from './debugger-chrome';
import { debuggerViewTabItem } from './debugger-chrome';
import { harnessNodeIcon } from './node-chrome';
import {
  ClientProductHarnessPanel,
  LoadBalancerProductHarnessPanel,
  PubSubProductHarnessPanel,
  RoomProductHarnessPanel,
  ServerProductHarnessPanel,
} from './product-harness-panel';

/** What every node panel reads from the console around it. */
export type HarnessNodeWindowContext = {
  readonly session: Accessor<ProductHarnessSession>;
  readonly revision: Accessor<number>;
  /** An accessor: the host hands over a fresh value on every change. */
  readonly nav: Accessor<HarnessConsoleNav>;
  /** The panel that owns the keyboard, when a panel does. */
  readonly keyboardPanel: Accessor<string | null>;
};

type NodeWindowProps = {
  readonly panel: HarnessPanelRef;
  readonly context: HarnessNodeWindowContext;
};

/** Shown for the moment between a node going and its panel closing. */
function NodeGone(props: { readonly title: string }): JSX.Element {
  return (
    <Surface
      tone="background"
      grow
      align="center"
      justify="center"
      padding="lg"
    >
      <EmptyState
        variant="compact"
        title="Not running"
        body={`${props.title} is not part of this session right now.`}
      />
    </Surface>
  );
}

function ClientWindow(props: NodeWindowProps): JSX.Element {
  const actor = () => {
    props.context.revision();
    const session = props.context.session();
    return session.snapshotRestoring || props.panel.node === null
      ? undefined
      : session.clients.get(props.panel.node);
  };
  const epoch = () => {
    props.context.revision();
    return props.context.session().snapshotEpoch;
  };
  return (
    <KeyboardShortcutScope
      active={props.context.keyboardPanel() === props.panel.id}
    >
      <Show when={actor()} fallback={<NodeGone title={props.panel.title} />}>
        {(found) => (
          <ClientProductHarnessPanel actor={found()} snapshotEpoch={epoch()} />
        )}
      </Show>
    </KeyboardShortcutScope>
  );
}

function NodeBody(
  props: NodeWindowProps & {
    readonly pane: PaneNavValue;
    readonly onPanePatch: (
      patch: PaneNavPatch,
      mode?: PaneNavHistoryMode
    ) => void;
  }
): JSX.Element {
  const session = () => props.context.session();
  const node = <T,>(nodes: ReadonlyMap<string, T>): T | undefined => {
    props.context.revision();
    return props.panel.node === null ? undefined : nodes.get(props.panel.node);
  };
  const gone = () => <NodeGone title={props.panel.title} />;
  return (
    <Switch>
      <Match when={props.panel.kind === 'lb'}>
        <LoadBalancerProductHarnessPanel
          session={session()}
          loadBalancer={session().loadBalancer}
          pane={props.pane}
        />
      </Match>
      <Match when={props.panel.kind === 'events'}>
        <PubSubProductHarnessPanel
          session={session()}
          pubsub={session().pubsub}
          pane={props.pane}
        />
      </Match>
      <Match when={props.panel.kind === 'server'}>
        <Show when={node(session().servers)} fallback={gone()}>
          {(server) => (
            <ServerProductHarnessPanel
              session={session()}
              node={server()}
              pane={props.pane}
              onPanePatch={props.onPanePatch}
            />
          )}
        </Show>
      </Match>
      <Match when={props.panel.kind === 'room'}>
        <Show when={node(session().rooms)} fallback={gone()}>
          {(room) => (
            <RoomProductHarnessPanel
              session={session()}
              room={room()}
              pane={props.pane}
            />
          )}
        </Show>
      </Match>
    </Switch>
  );
}

/** A server-side node: its views in a tab strip over the view on show. */
function NodeWindow(props: NodeWindowProps): JSX.Element {
  const views = () => viewsForKind(props.panel.kind);
  // A memo: the host hands over a fresh nav on every change, and a view
  // that reads the pane must not start over when another window moved.
  const view = createMemo(() =>
    coerceDebuggerView(
      props.panel.kind,
      props.context.nav().panes[props.panel.id]?.view
    )
  );
  const pane = createMemo((): PaneNavValue => ({ view: view() }));
  const patch = (next: PaneNavPatch, mode?: PaneNavHistoryMode): void => {
    props.context.nav().onPanePatch(props.panel.id, next, mode);
  };
  return (
    <StackVertical grow>
      <TabStrip
        aria-label={`${props.panel.title} views`}
        items={views().map(debuggerViewTabItem)}
        selectedId={pane().view}
        onSelect={(id) => patch({ view: id as DebuggerViewId })}
      />
      <NodeBody
        panel={props.panel}
        context={props.context}
        pane={pane()}
        onPanePatch={patch}
      />
    </StackVertical>
  );
}

/** The window-manager panel for one node of the session. */
export function harnessWindowPanel(
  panel: HarnessPanelRef,
  context: HarnessNodeWindowContext
): WindowPanel {
  return {
    id: panel.id,
    title: panel.title,
    icon: harnessNodeIcon(panel.kind),
    content: () => (
      <Show
        when={panel.kind === 'client'}
        fallback={<NodeWindow panel={panel} context={context} />}
      >
        <ClientWindow panel={panel} context={context} />
      </Show>
    ),
  };
}
