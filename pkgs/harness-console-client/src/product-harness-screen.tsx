import type { HarnessChromeKind } from '@pkgs/harness-console-shared/node';
import type {
  ProductHarnessActor,
  ProductHarnessPaletteCommand,
  ProductHarnessSession,
} from '@pkgs/harness-console-shared/ports';
import { CommandPalette } from '@pkgs/ui-client/command-palette';
import { CommandRegistryProvider } from '@pkgs/ui-client/command-registry-context';
import { ErrorState } from '@pkgs/ui-client/error-state';
import { KeyboardShortcutScope } from '@pkgs/ui-client/keyboard-shortcut-scope';
import { LoadingState } from '@pkgs/ui-client/loading-state';
import { OverlayPortalProvider } from '@pkgs/ui-client/overlay-portal';
import { RegisterCommand } from '@pkgs/ui-client/register-command';
import { SurfaceStackProvider } from '@pkgs/ui-client/surface-stack';
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
  DebuggerChromeNav,
  PaneNavPatch,
  PaneNavValue,
} from './debugger-chrome';
import { debuggerInstanceTabItem } from './debugger-chrome';
import { DebuggerColumn } from './debugger-columns';
import { DebuggerShell } from './debugger-shell';
import { ProductHarnessAppearanceCommands } from './product-harness-appearance-commands';
import {
  ProductHarnessExitButton,
  ProductHarnessExitCommand,
} from './product-harness-exit';
import type { ProductHarnessClientColumnShellProps } from './product-harness-kind-pane';
import {
  ProductHarnessKindPane,
  productHarnessInstancesForKind,
  productHarnessPaneKey,
  productHarnessViewsForKind,
  resolveProductHarnessInstanceId,
  resolveProductHarnessPane,
} from './product-harness-kind-pane';
import { ProductHarnessSnapshotChrome } from './product-harness-snapshot-chrome';
import { ProductHarnessTopologyChrome } from './product-harness-topology-chrome';
import { selectUnifiedNode } from './select-unified-node';
import { useHarnessConsoleLayout } from './use-harness-console-layout';
import type { ProductHarnessSessionState } from './use-product-harness-session';

export function ProductHarnessScreen(props: {
  readonly state: ProductHarnessSessionState;
  readonly kind: HarnessChromeKind;
  readonly instance: string;
  readonly panes: Readonly<Record<string, PaneNavValue>>;
  readonly onKindChange: (kind: HarnessChromeKind) => void;
  readonly onInstanceChange: (instance: string) => void;
  readonly onPanePatch: (
    id: string,
    patch: PaneNavPatch,
    mode?: 'push' | 'replace'
  ) => void;
  /** Retry boot after an error (chunk load / harness init). */
  readonly onReload?: () => void;
  /** Leave the harness for the product app. */
  readonly onExit: () => void;
}) {
  const readyState = () =>
    props.state.status === 'ready' ? props.state : null;
  return (
    <Switch>
      <Match when={props.state.status === 'error'}>
        <div class="box" style={centerSx}>
          <ErrorState
            title="Failed to boot harness"
            body={props.state.status === 'error' ? props.state.error : ''}
            {...(props.onReload !== undefined
              ? { retry: { label: 'Reload', onClick: props.onReload } }
              : {})}
          />
        </div>
      </Match>
      <Match when={readyState() === null}>
        <div class="box" style={centerSx}>
          <LoadingState caption="Booting harness…" />
        </div>
      </Match>
      <Match when={readyState()}>
        {(state) => (
          <OverlayPortalProvider>
            <SurfaceStackProvider>
              <FocusedProductHarnessScreen
                session={state().session}
                onExit={props.onExit}
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

function FocusedProductHarnessScreen(props: {
  readonly session: ProductHarnessSession;
  readonly chrome: DebuggerChromeNav;
  readonly onExit: () => void;
}) {
  const layout = useHarnessConsoleLayout();
  const [focusedClientId, setFocusedClientId] = createSignal<string | null>(
    null
  );

  createEffect(() => {
    if (props.chrome.kind !== 'client') setFocusedClientId(null);
  });

  // Harness registry owns shortcuts when no client panel does: non-client
  // chrome, or column layout with no focused column. Tab layout always hands
  // shortcuts to the visible client via the column `KeyboardShortcutScope`.
  // Gate with reactive `enableDefaultShortcuts` (not a tree-wide scope) so the
  // chrome search button can still `palette.open()` while a client is focused.
  const harnessShortcutsActive = (): boolean =>
    props.chrome.kind !== 'client' ||
    (layout.multiClientColumns && focusedClientId() === null);

  return (
    <CommandRegistryProvider enableDefaultShortcuts={harnessShortcutsActive()}>
      <ProductHarnessAppearanceCommands />
      <ProductHarnessExitCommand onExit={props.onExit} />
      <ReadyProductHarnessScreen
        session={props.session}
        chrome={props.chrome}
        onExit={props.onExit}
        focusedClientId={focusedClientId()}
        onFocusedClientIdChange={setFocusedClientId}
      />
      <CommandPalette />
    </CommandRegistryProvider>
  );
}

function ProductHarnessClientColumnShell(
  props: ProductHarnessClientColumnShellProps & { children?: JSX.Element }
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
function productHarnessUnifiedNodes(
  session: ProductHarnessSession,
  clients: readonly ProductHarnessActor[]
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
  current: HarnessChromeKind,
  instanceId: string | null
): string | null {
  if (current === 'client' || current === 'room' || current === 'server') {
    return instanceId;
  }
  if (current === 'events') return 'events';
  return current;
}

type ReadyScreenProps = {
  readonly session: ProductHarnessSession;
  readonly chrome: DebuggerChromeNav;
  readonly onExit: () => void;
  readonly focusedClientId: string | null;
  readonly onFocusedClientIdChange: (id: string | null) => void;
};

/** Session maps mutate in place — topology reads must track `revision`. */
function useReadyProductHarnessModel(props: ReadyScreenProps) {
  const [revision, setRevision] = createSignal(props.session.revision);
  createEffect(() => {
    const session = props.session;
    setRevision(session.revision);
    const unsub = session.subscribe(() => setRevision(session.revision));
    onCleanup(unsub);
  });

  const kind = () => props.chrome.kind;
  const clients = createMemo(() => {
    revision();
    return props.session.snapshotRestoring
      ? []
      : [...props.session.clients.values()];
  });
  const servers = createMemo(() => {
    revision();
    return [...props.session.servers.values()];
  });
  const instances = createMemo(() => {
    revision();
    return productHarnessInstancesForKind(props.session, kind(), clients());
  });
  const instanceId = createMemo(() =>
    resolveProductHarnessInstanceId(props.chrome.instance, instances())
  );
  const unifiedNodes = createMemo(() => {
    servers();
    return productHarnessUnifiedNodes(props.session, clients());
  });
  const selectedNode = createMemo(() =>
    selectedUnifiedNodeId(kind(), instanceId())
  );
  const shellPaneKey = createMemo(() =>
    productHarnessPaneKey(kind(), instanceId())
  );
  const shellPane = createMemo(() =>
    resolveProductHarnessPane(props.chrome.panes, shellPaneKey(), kind())
  );
  // Client columns own their view strips; shell strip only for non-client.
  const views = createMemo(() =>
    kind() === 'client' ? [] : productHarnessViewsForKind(kind())
  );
  const paletteCommands = createMemo(() => {
    revision();
    return props.session.listPaletteCommands();
  });
  return {
    kind,
    clients,
    servers,
    instances,
    instanceId,
    unifiedNodes,
    selectedNode,
    shellPaneKey,
    shellPane,
    views,
    paletteCommands,
    snapshotEpoch: () => props.session.snapshotEpoch,
  };
}

function ReadyProductHarnessScreen(props: ReadyScreenProps) {
  const model = useReadyProductHarnessModel(props);
  const clearClientFocus = () => {
    props.onFocusedClientIdChange(null);
  };
  return (
    <div
      class="box flex-1 min-h-0 min-w-0 bg-background"
      style={{ overflow: 'clip' }}
    >
      <ProductHarnessPaletteRegistrations commands={model.paletteCommands()} />
      <ProductHarnessDebuggerShell
        session={props.session}
        chrome={props.chrome}
        onExit={props.onExit}
        clients={model.clients()}
        kind={model.kind}
        instances={model.instances}
        instanceId={model.instanceId}
        unifiedNodes={model.unifiedNodes}
        selectedNode={model.selectedNode}
        onUnifiedNodeChange={(id) =>
          selectUnifiedNode(
            props,
            {
              clients: model.clients(),
              servers: model.servers(),
              loadBalancerId: props.session.loadBalancer.id,
            },
            id
          )
        }
        views={model.views}
        shellPane={model.shellPane}
        shellPaneKey={model.shellPaneKey}
        snapshotEpoch={model.snapshotEpoch}
        focusedClientId={props.focusedClientId}
        onFocusedClientIdChange={props.onFocusedClientIdChange}
        clearClientFocus={clearClientFocus}
      />
    </div>
  );
}

function ProductHarnessDebuggerShell(props: {
  readonly session: ProductHarnessSession;
  readonly chrome: DebuggerChromeNav;
  readonly onExit: () => void;
  readonly clients: readonly ProductHarnessActor[];
  readonly kind: () => HarnessChromeKind;
  readonly instances: () => readonly {
    readonly id: string;
    readonly kind: string;
  }[];
  readonly instanceId: () => string | null;
  readonly unifiedNodes: () => readonly import('@pkgs/ui-devtools-client/tab-strip-types').TabStripItem[];
  readonly selectedNode: () => string | null;
  readonly onUnifiedNodeChange: (id: string) => void;
  readonly views: () => readonly import('@pkgs/harness-console-shared/debugger-views').DebuggerViewId[];
  readonly shellPane: () => PaneNavValue;
  readonly shellPaneKey: () => string;
  readonly snapshotEpoch: () => number;
  readonly focusedClientId: string | null;
  readonly onFocusedClientIdChange: (id: string | null) => void;
  readonly clearClientFocus: () => void;
}) {
  return (
    <DebuggerShell
      onChromePointerDown={props.clearClientFocus}
      kindTrailing={
        <div class="box flex-row items-center gap-1 min-w-0">
          <ProductHarnessTopologyChrome session={props.session} />
          <ProductHarnessSnapshotChrome session={props.session} />
          <ProductHarnessExitButton onExit={props.onExit} />
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
      <ProductHarnessKindPane
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
        clientColumnShell={ProductHarnessClientColumnShell}
      />
    </DebuggerShell>
  );
}

function ProductHarnessPaletteRegistrations(props: {
  readonly commands: readonly ProductHarnessPaletteCommand[];
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
