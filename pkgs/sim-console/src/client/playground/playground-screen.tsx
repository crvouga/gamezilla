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
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
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
  const { state, kind, instance, panes, onReload } = props;

  if (state.status === 'error') {
    return (
      <Box sx={centerSx}>
        <ErrorState
          title="Failed to boot playground"
          body={state.error}
          {...(onReload !== undefined
            ? { retry: { label: 'Reload', onPress: onReload } }
            : {})}
        />
      </Box>
    );
  }
  if (state.status !== 'ready') {
    return (
      <Box sx={centerSx}>
        <LoadingState caption="Booting playground…" />
      </Box>
    );
  }

  return (
    <OverlayPortalProvider>
      <SurfaceStackProvider>
        <FocusedPlaygroundScreen
          session={state.session}
          chrome={{
            kind,
            instance,
            panes,
            onKindChange: props.onKindChange,
            onInstanceChange: props.onInstanceChange,
            onPanePatch: props.onPanePatch,
          }}
        />
      </SurfaceStackProvider>
    </OverlayPortalProvider>
  );
}

function FocusedPlaygroundScreen(props: {
  readonly session: PlaygroundSession;
  readonly chrome: DebuggerChromeNav;
}) {
  const { session, chrome } = props;
  const [focusedClientId, setFocusedClientId] = useState<string | null>(null);

  useEffect(() => {
    if (chrome.kind !== 'client') setFocusedClientId(null);
  }, [chrome.kind]);

  return (
    <CommandRegistryProvider enableDefaultShortcuts={focusedClientId === null}>
      <PlaygroundAppearanceCommands />
      <ReadyPlaygroundScreen
        session={session}
        chrome={chrome}
        focusedClientId={focusedClientId}
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
  readonly children: ReactNode;
}) {
  return (
    <DebuggerColumn
      key={args.actor.id}
      focused={args.focused}
      onActivate={args.onActivate}
    >
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
  const { session, chrome, focusedClientId, onFocusedClientIdChange } = props;
  const tick = useSyncExternalStore(
    session.subscribe,
    () => session.revision,
    () => session.revision
  );
  void tick;
  const kind = chrome.kind;
  const clients = session.snapshotRestoring
    ? []
    : [...session.clients.values()];
  const instances = playgroundInstancesForKind(session, kind, clients);
  const instanceId = resolvePlaygroundInstanceId(chrome.instance, instances);
  const shellPaneKey = playgroundPaneKey(kind, instanceId);
  const shellPane = resolvePlaygroundPane(chrome.panes, shellPaneKey, kind);
  // Client columns own their view strips; shell strip only for non-client.
  const views = kind === 'client' ? [] : playgroundViewsForKind(kind);
  const paletteCommands = useMemo(
    () => session.listPaletteCommands(),
    [session, tick]
  );
  const snapshotEpoch = session.snapshotEpoch;
  const clearClientFocus = useCallback(() => {
    onFocusedClientIdChange(null);
  }, [onFocusedClientIdChange]);

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        background: 'background',
        overflow: 'hidden',
      }}
    >
      <PlaygroundPaletteRegistrations commands={paletteCommands} />
      <DebuggerShell
        showPlayer={false}
        frames={[]}
        selectedFrameIndex={0}
        onSelectFrame={() => undefined}
        onChromePointerDown={clearClientFocus}
        kindTrailing={<PlaygroundSnapshotChrome session={session} />}
        kind={kind}
        onKindChange={chrome.onKindChange}
        instances={instances}
        instanceId={instanceId}
        onInstanceChange={(id) => {
          chrome.onInstanceChange(id);
          if (kind === 'client') onFocusedClientIdChange(id);
        }}
        views={views}
        view={shellPane.view}
        onViewChange={(next) =>
          chrome.onPanePatch(shellPaneKey, { view: next })
        }
      >
        <PlaygroundKindPane
          session={session}
          kind={kind}
          panes={chrome.panes}
          instanceId={instanceId}
          clients={clients}
          snapshotEpoch={snapshotEpoch}
          focusedClientId={focusedClientId}
          onFocusedClientIdChange={onFocusedClientIdChange}
          onPanePatch={chrome.onPanePatch}
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
    <>
      {props.commands.map((cmd) => (
        <RegisterCommand
          key={cmd.id}
          id={cmd.id}
          title={cmd.title}
          {...(cmd.subtitle !== undefined ? { subtitle: cmd.subtitle } : {})}
          {...(cmd.category !== undefined ? { category: cmd.category } : {})}
          {...(cmd.keywords !== undefined
            ? { keywords: [...cmd.keywords] }
            : {})}
          run={cmd.run}
        />
      ))}
    </>
  );
}

const centerSx = {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  background: 'background',
  padding: 4,
} as const;
