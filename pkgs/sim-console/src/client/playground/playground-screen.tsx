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
  PlaygroundActor,
  PlaygroundPaletteCommand,
  PlaygroundSession,
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
import { PlaygroundAppearanceCommands } from './playground-appearance-commands';
import {
  PlaygroundKindPane,
  playgroundInstancesForKind,
  playgroundPaneKey,
  playgroundViewsForKind,
  resolvePlaygroundInstanceId,
  resolvePlaygroundPane,
} from './playground-kind-pane';
import { PlaygroundSnapshotChrome } from './playground-snapshot-chrome';
import type { PlaygroundSessionState } from './use-playground-session';

export type { SimChromeKind as PlaygroundKindId } from '../../shared/sim-node';

export function PlaygroundScreen(props: {
  readonly state: PlaygroundSessionState;
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
            title="Failed to boot playground"
            body={props.state.status === 'error' ? props.state.error : ''}
            {...(props.onReload !== undefined
              ? { retry: { label: 'Reload', onClick: props.onReload } }
              : {})}
          />
        </div>
      </Match>
      <Match when={readyState() === null}>
        <div class="box" style={centerSx}>
          <LoadingState caption="Booting playground…" />
        </div>
      </Match>
      <Match when={readyState()}>
        {(state) => (
          <OverlayPortalProvider>
            <SurfaceStackProvider>
              <FocusedPlaygroundScreen
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

function FocusedPlaygroundScreen(props: {
  readonly session: PlaygroundSession;
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
      <PlaygroundAppearanceCommands />
      <ReadyPlaygroundScreen
        session={props.session}
        chrome={props.chrome}
        focusedClientId={focusedClientId()}
        onFocusedClientIdChange={setFocusedClientId}
      />
      <CommandPalette />
    </CommandRegistryProvider>
  );
}

function playgroundClientColumnShell(args: {
  readonly actor: PlaygroundActor;
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

function ReadyPlaygroundScreen(props: {
  readonly session: PlaygroundSession;
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
    playgroundInstancesForKind(props.session, kind(), clients())
  );
  const instanceId = createMemo(() =>
    resolvePlaygroundInstanceId(props.chrome.instance, instances())
  );
  const unifiedNodes = createMemo(() => {
    const clientNodes = instances().map((node) =>
      debuggerInstanceTabItem({ id: node.id, kind: node.kind })
    );
    const fixed = [
      { id: 'server', kind: 'server' },
      { id: 'events', kind: 'events' },
      ...(props.session.rooms.size > 0
        ? [{ id: [...props.session.rooms.keys()][0]!, kind: 'room' }]
        : []),
    ];
    return [...clientNodes, ...fixed.map(debuggerInstanceTabItem)];
  });
  const selectedNode = createMemo(() =>
    kind() === 'client' ? instanceId() : kind() === 'events' ? 'events' : kind()
  );
  const shellPaneKey = createMemo(() =>
    playgroundPaneKey(kind(), instanceId())
  );
  const shellPane = createMemo(() =>
    resolvePlaygroundPane(props.chrome.panes, shellPaneKey(), kind())
  );
  // Client columns own their view strips; shell strip only for non-client.
  const views = createMemo(() =>
    kind() === 'client' ? [] : playgroundViewsForKind(kind())
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
      <PlaygroundPaletteRegistrations commands={paletteCommands()} />
      <PlaygroundDebuggerShell
        session={props.session}
        chrome={props.chrome}
        clients={clients()}
        kind={kind}
        instances={instances}
        instanceId={instanceId}
        unifiedNodes={unifiedNodes}
        selectedNode={selectedNode}
        onUnifiedNodeChange={(id) => selectUnifiedNode(props, instances(), id)}
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

function selectUnifiedNode(
  props: {
    readonly chrome: DebuggerChromeNav;
    readonly onFocusedClientIdChange: (id: string | null) => void;
  },
  instances: readonly { readonly id: string; readonly kind: string }[],
  id: string
): void {
  const node = instances.find((entry) => entry.id === id);
  if (node?.kind === 'client') {
    props.chrome.onKindChange('client');
    props.chrome.onInstanceChange(id);
    props.onFocusedClientIdChange(id);
  } else if (id === 'server') {
    props.chrome.onKindChange('server');
  } else if (id === 'events') {
    props.chrome.onKindChange('events');
  } else {
    props.chrome.onKindChange('room');
    props.chrome.onInstanceChange(id);
  }
}

function PlaygroundDebuggerShell(props: {
  readonly session: PlaygroundSession;
  readonly chrome: DebuggerChromeNav;
  readonly clients: readonly PlaygroundActor[];
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
      kindTrailing={<PlaygroundSnapshotChrome session={props.session} />}
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
      <PlaygroundKindPane
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
        clientColumnShell={playgroundClientColumnShell}
      />
    </DebuggerShell>
  );
}

function PlaygroundPaletteRegistrations(props: {
  readonly commands: readonly PlaygroundPaletteCommand[];
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
  background: 'background',
  padding: '16px',
} as const;
