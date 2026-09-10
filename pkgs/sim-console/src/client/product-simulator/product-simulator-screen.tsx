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
import {
  type DebuggerChromeNav,
  debuggerInstanceTabItem,
  type PaneNavPatch,
  type PaneNavValue,
} from '../debugger-chrome';
import { ProductSimulatorAppearanceCommands } from './product-simulator-appearance-commands';
import {
  ProductSimulatorKindPane,
  productSimulatorInstancesForKind,
  productSimulatorPaneKey,
  productSimulatorViewsForKind,
  resolveProductSimulatorInstanceId,
  resolveProductSimulatorPane,
} from './product-simulator-kind-pane';
import { ProductSimulatorSnapshotChrome } from './product-simulator-snapshot-chrome';
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
  const [focusedClientId, setFocusedClientId] = createSignal<string | null>(
    null
  );

  createEffect(() => {
    if (props.chrome.kind !== 'client') setFocusedClientId(null);
  });

  return (
    <CommandRegistryProvider
      enableDefaultShortcuts={focusedClientId() === null}
    >
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

function productSimulatorClientColumnShell(args: {
  readonly actor: ProductSimulatorActor;
  readonly focused: boolean;
  readonly onActivate: () => void;
  readonly children: JSX.Element;
}) {
  return (
    <DebuggerColumn focused={args.focused} onActivate={args.onActivate}>
      <KeyboardShortcutScope active={args.focused}>
        {args.children}
      </KeyboardShortcutScope>
    </DebuggerColumn>
  );
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
  // Unified strip must list clients always — not kind-scoped `instances`,
  // or Client tabs vanish on Server/PubSub/Room and clicks mis-route as room.
  const unifiedNodes = createMemo(() => {
    const clientNodes = clients().map((actor) =>
      debuggerInstanceTabItem({ id: actor.id, kind: 'client' })
    );
    const fixed = [
      { id: 'server', kind: 'server' },
      { id: 'events', kind: 'events' },
      ...[...props.session.rooms.values()].map((room) => ({
        id: room.id,
        kind: 'room' as const,
      })),
    ];
    return [...clientNodes, ...fixed.map(debuggerInstanceTabItem)];
  });
  const selectedNode = createMemo(() => {
    const current = kind();
    if (current === 'client') return instanceId();
    if (current === 'events') return 'events';
    if (current === 'server') return 'server';
    // Room tab id is the topic UUID (not the bare kind).
    if (current === 'room') return instanceId();
    return current;
  });
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
    <div class="box flex-1 min-h-[0] bg-background overflow-hidden">
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
          selectUnifiedNode(props, clients(), id)
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
      kindTrailing={<ProductSimulatorSnapshotChrome session={props.session} />}
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
        clientColumnShell={productSimulatorClientColumnShell}
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
