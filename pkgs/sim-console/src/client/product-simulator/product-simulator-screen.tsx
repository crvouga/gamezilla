import {
  CommandPalette,
  CommandRegistryProvider,
  ErrorState,
  KeyboardShortcutScope,
  LoadingState,
  OverlayPortalProvider,
  RegisterCommand,
  SurfaceStackProvider,
} from '@pkgs/ui';
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  Match,
  onCleanup,
  Switch,
} from 'solid-js';
import type {
  ProductSimulatorActor,
  ProductSimulatorPaletteCommand,
  ProductSimulatorSession,
} from '../../shared/ports';
import type { SimChromeKind } from '../../shared/sim-node';
import { DebuggerColumn } from '../debugger/debugger-columns';
import { DebuggerShell } from '../debugger/debugger-shell';
import { useSimConsoleLayout } from '../debugger/use-sim-console-layout';
import {
  type DebuggerChromeNav,
  debuggerInstanceTabItem,
  type PaneNavPatch,
  type PaneNavValue,
} from '../debugger-chrome';
import { ProductSimulatorAppearanceCommands } from './product-simulator-appearance-commands';
import {
  type ProductSimulatorClientColumnShellProps,
  ProductSimulatorKindPane,
  productSimulatorInstancesForKind,
  productSimulatorPaneKey,
  productSimulatorViewsForKind,
  resolveProductSimulatorInstanceId,
  resolveProductSimulatorPane,
} from './product-simulator-kind-pane';
import { ProductSimulatorSnapshotChrome } from './product-simulator-snapshot-chrome';
import { ProductSimulatorTopologyChrome } from './product-simulator-topology-chrome';
import { selectUnifiedNode } from './select-unified-node';
import type { ProductSimulatorSessionState } from './use-product-simulator-session';

export type { SimChromeKind as ProductSimulatorKindId } from '../../shared/sim-node';

export function ProductSimulatorScreen(props: {
  readonly state: ProductSimulatorSessionState;
  readonly kind: SimChromeKind;
  readonly instance: string;
  readonly panes: Readonly<Record<string, PaneNavValue>>;
  readonly onKindChange: (kind: SimChromeKind) => void;
  readonly onInstanceChange: (instance: string) => void;
  readonly onPanePatch: (
    id: string,
    patch: PaneNavPatch,
    mode?: 'push' | 'replace'
  ) => void;
  /** Retry boot after an error (chunk load / sim init). */
  readonly onReload?: () => void;
}) {
  const readyState = () =>
    props.state.status === 'ready' ? props.state : null;
  return (
    <Switch>
      <Match when={props.state.status === 'error'}>
        <div class="box" style={centerSx}>
          <ErrorState
            title="Failed to boot simulator"
            body={props.state.status === 'error' ? props.state.error : ''}
            {...(props.onReload !== undefined
              ? { retry: { label: 'Reload', onClick: props.onReload } }
              : {})}
          />
        </div>
      </Match>
      <Match when={readyState() === null}>
        <div class="box" style={centerSx}>
          <LoadingState caption="Booting simulator…" />
        </div>
      </Match>
      <Match when={readyState()}>
        {(state) => (
          <OverlayPortalProvider>
            <SurfaceStackProvider>
              <FocusedProductSimulatorScreen
                session={state().session}
                chrome={{
                  kind: props.kind,
                  instance: props.instance,
                  panes: props.panes,
                  onKindChange: props.onKindChange,
                  onInstanceChange: props.onInstanceChange,
                  onPanePatch: props.onPanePatch,
                }}
              />
            </SurfaceStackProvider>
          </OverlayPortalProvider>
        )}
      </Match>
    </Switch>
  );
}

function FocusedProductSimulatorScreen(props: {
  readonly session: ProductSimulatorSession;
  readonly chrome: DebuggerChromeNav;
}) {
  const layout = useSimConsoleLayout();
  const [focusedClientId, setFocusedClientId] = createSignal<string | null>(
    null
  );

  createEffect(() => {
    if (props.chrome.kind !== 'client') setFocusedClientId(null);
  });

  // Simulator registry owns shortcuts when no client panel does: non-client
  // chrome, or column layout with no focused column. Tab layout always hands
  // shortcuts to the visible client via the column `KeyboardShortcutScope`.
  // Gate with reactive `enableDefaultShortcuts` (not a tree-wide scope) so the
  // chrome search button can still `palette.open()` while a client is focused.
  const simShortcutsActive = (): boolean =>
    props.chrome.kind !== 'client' ||
    (layout.multiClientColumns && focusedClientId() === null);

  return (
    <CommandRegistryProvider enableDefaultShortcuts={simShortcutsActive()}>
      <ProductSimulatorAppearanceCommands />
      <ReadyProductSimulatorScreen
        session={props.session}
        chrome={props.chrome}
        focusedClientId={focusedClientId()}
        onFocusedClientIdChange={setFocusedClientId}
      />
      <CommandPalette />
    </CommandRegistryProvider>
  );
}

function ProductSimulatorClientColumnShell(
  props: ProductSimulatorClientColumnShellProps & { children?: JSX.Element }
): JSX.Element {
  void props.actor;
  return (
    <DebuggerColumn focused={props.focused} onActivate={props.onActivate}>
      <KeyboardShortcutScope active={props.focused}>
        {props.children}
      </KeyboardShortcutScope>
    </DebuggerColumn>
  );
}

/**
 * Clients always listed — not kind-scoped instances (tabs vanish otherwise).
 * The strip mirrors the request path: clients, the balancer, each API
 * instance, pubsub, then live rooms.
 */
function productSimulatorUnifiedNodes(
  session: ProductSimulatorSession,
  clients: readonly ProductSimulatorActor[]
) {
  const nodes = [
    ...clients.map((actor) => ({ id: actor.id, kind: 'client' })),
    { id: session.loadBalancer.id, kind: 'lb' },
    ...[...session.servers.values()].map((server) => ({
      id: server.id,
      kind: 'server',
    })),
    { id: 'events', kind: 'events' },
    ...[...session.rooms.values()].map((room) => ({
      id: room.id,
      kind: 'room',
    })),
  ];
  return nodes.map(debuggerInstanceTabItem);
}

function selectedUnifiedNodeId(
  current: SimChromeKind,
  instanceId: string | null
): string | null {
  if (current === 'client' || current === 'room' || current === 'server') {
    return instanceId;
  }
  if (current === 'events') return 'events';
  return current;
}

function ReadyProductSimulatorScreen(props: {
  readonly session: ProductSimulatorSession;
  readonly chrome: DebuggerChromeNav;
  readonly focusedClientId: string | null;
  readonly onFocusedClientIdChange: (id: string | null) => void;
}) {
  const [revision, setRevision] = createSignal(props.session.revision);
  createEffect(() => {
    const session = props.session;
    setRevision(session.revision);
    const unsub = session.subscribe(() => setRevision(session.revision));
    onCleanup(unsub);
  });

  const kind = () => props.chrome.kind;
  const clients = createMemo(() =>
    props.session.snapshotRestoring ? [] : [...props.session.clients.values()]
  );
  const instances = createMemo(() =>
    productSimulatorInstancesForKind(props.session, kind(), clients())
  );
  const instanceId = createMemo(() =>
    resolveProductSimulatorInstanceId(props.chrome.instance, instances())
  );
  const unifiedNodes = createMemo(() =>
    productSimulatorUnifiedNodes(props.session, clients())
  );
  const selectedNode = createMemo(() =>
    selectedUnifiedNodeId(kind(), instanceId())
  );
  const shellPaneKey = createMemo(() =>
    productSimulatorPaneKey(kind(), instanceId())
  );
  const shellPane = createMemo(() =>
    resolveProductSimulatorPane(props.chrome.panes, shellPaneKey(), kind())
  );
  // Client columns own their view strips; shell strip only for non-client.
  const views = createMemo(() =>
    kind() === 'client' ? [] : productSimulatorViewsForKind(kind())
  );
  const paletteCommands = createMemo(() => {
    revision();
    return props.session.listPaletteCommands();
  });
  const snapshotEpoch = () => props.session.snapshotEpoch;
  const clearClientFocus = () => {
    props.onFocusedClientIdChange(null);
  };
  return (
    <div
      class="box flex-1 min-h-[0] min-w-[0] bg-background"
      style={{ overflow: 'clip' }}
    >
      <ProductSimulatorPaletteRegistrations commands={paletteCommands()} />
      <ProductSimulatorDebuggerShell
        session={props.session}
        chrome={props.chrome}
        clients={clients()}
        kind={kind}
        instances={instances}
        instanceId={instanceId}
        unifiedNodes={unifiedNodes}
        selectedNode={selectedNode}
        onUnifiedNodeChange={(id) =>
          selectUnifiedNode(
            props,
            {
              clients: clients(),
              servers: [...props.session.servers.values()],
              loadBalancerId: props.session.loadBalancer.id,
            },
            id
          )
        }
        views={views}
        shellPane={shellPane}
        shellPaneKey={shellPaneKey}
        snapshotEpoch={snapshotEpoch}
        focusedClientId={props.focusedClientId}
        onFocusedClientIdChange={props.onFocusedClientIdChange}
        clearClientFocus={clearClientFocus}
      />
    </div>
  );
}

function ProductSimulatorDebuggerShell(props: {
  readonly session: ProductSimulatorSession;
  readonly chrome: DebuggerChromeNav;
  readonly clients: readonly ProductSimulatorActor[];
  readonly kind: () => SimChromeKind;
  readonly instances: () => readonly {
    readonly id: string;
    readonly kind: string;
  }[];
  readonly instanceId: () => string | null;
  readonly unifiedNodes: () => readonly import('@pkgs/ui').TabStripItem[];
  readonly selectedNode: () => string | null;
  readonly onUnifiedNodeChange: (id: string) => void;
  readonly views: () => readonly import('../../shared/debugger-views').DebuggerViewId[];
  readonly shellPane: () => PaneNavValue;
  readonly shellPaneKey: () => string;
  readonly snapshotEpoch: () => number;
  readonly focusedClientId: string | null;
  readonly onFocusedClientIdChange: (id: string | null) => void;
  readonly clearClientFocus: () => void;
}) {
  return (
    <DebuggerShell
      showPlayer={false}
      frames={[]}
      selectedFrameIndex={0}
      onSelectFrame={() => undefined}
      onChromePointerDown={props.clearClientFocus}
      kindTrailing={
        <div class="box flex-row items-center gap-1 min-w-[0]">
          <ProductSimulatorTopologyChrome session={props.session} />
          <ProductSimulatorSnapshotChrome session={props.session} />
        </div>
      }
      kind={props.kind()}
      onKindChange={props.chrome.onKindChange}
      unifiedNodes={props.unifiedNodes()}
      selectedNode={props.selectedNode() ?? ''}
      onNodeChange={props.onUnifiedNodeChange}
      instances={props.instances()}
      instanceId={props.instanceId()}
      onInstanceChange={props.chrome.onInstanceChange}
      views={props.views()}
      view={props.shellPane().view}
      onViewChange={(next) =>
        props.chrome.onPanePatch(props.shellPaneKey(), { view: next })
      }
    >
      <ProductSimulatorKindPane
        session={props.session}
        kind={props.kind()}
        panes={props.chrome.panes}
        instanceId={props.instanceId()}
        clients={props.clients}
        snapshotEpoch={props.snapshotEpoch()}
        focusedClientId={props.focusedClientId}
        onFocusedClientIdChange={props.onFocusedClientIdChange}
        onPanePatch={props.chrome.onPanePatch}
        onClientColumnsOutsidePointerDown={props.clearClientFocus}
        clientColumnShell={ProductSimulatorClientColumnShell}
      />
    </DebuggerShell>
  );
}

function ProductSimulatorPaletteRegistrations(props: {
  readonly commands: readonly ProductSimulatorPaletteCommand[];
}) {
  return (
    <For each={props.commands}>
      {(cmd) => (
        <RegisterCommand
          id={cmd.id}
          title={cmd.title}
          {...(cmd.subtitle !== undefined ? { subtitle: cmd.subtitle } : {})}
          {...(cmd.category !== undefined ? { category: cmd.category } : {})}
          {...(cmd.keywords !== undefined
            ? { keywords: [...cmd.keywords] }
            : {})}
          run={cmd.run}
        />
      )}
    </For>
  );
}

const centerSx = {
  flex: 1,
  'align-items': 'center',
  'justify-content': 'center',
  background: 'var(--ui-color-background)',
  padding: '16px',
} as const;
