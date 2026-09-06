import {
  Box,
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
import type {
  DebuggerChromeNav,
  PaneNavPatch,
  PaneNavValue,
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
  /** Retry boot after an error (Metro chunk / sim init). */
  readonly onReload?: () => void;
}) {
  const readyState = () =>
    props.state.status === 'ready' ? props.state : null;
  return (
    <Switch>
      <Match when={props.state.status === 'error'}>
        <Box sx={centerSx}>
          <ErrorState
            title="Failed to boot playground"
            body={props.state.status === 'error' ? props.state.error : ''}
            {...(props.onReload !== undefined
              ? { retry: { label: 'Reload', onClick: props.onReload } }
              : {})}
          />
        </Box>
      </Match>
      <Match when={readyState() === null}>
        <Box sx={centerSx}>
          <LoadingState caption="Booting playground…" />
        </Box>
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
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        background: 'background',
        overflow: 'hidden',
      }}
    >
      <PlaygroundPaletteRegistrations commands={paletteCommands()} />
      <DebuggerShell
        showPlayer={false}
        frames={[]}
        selectedFrameIndex={0}
        onSelectFrame={() => undefined}
        onChromePointerDown={clearClientFocus}
        kindTrailing={<PlaygroundSnapshotChrome session={props.session} />}
        kind={kind()}
        onKindChange={props.chrome.onKindChange}
        instances={instances()}
        instanceId={instanceId()}
        onInstanceChange={(id) => {
          props.chrome.onInstanceChange(id);
          if (kind() === 'client') props.onFocusedClientIdChange(id);
        }}
        views={views()}
        view={shellPane().view}
        onViewChange={(next) =>
          props.chrome.onPanePatch(shellPaneKey(), { view: next })
        }
      >
        <PlaygroundKindPane
          session={props.session}
          kind={kind()}
          panes={props.chrome.panes}
          instanceId={instanceId()}
          clients={clients()}
          snapshotEpoch={snapshotEpoch()}
          focusedClientId={props.focusedClientId}
          onFocusedClientIdChange={props.onFocusedClientIdChange}
          onPanePatch={props.chrome.onPanePatch}
          onClientColumnsOutsidePointerDown={clearClientFocus}
          clientColumnShell={playgroundClientColumnShell}
        />
      </DebuggerShell>
    </Box>
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
  alignItems: 'center',
  justifyContent: 'center',
  background: 'background',
  padding: 4,
} as const;
