import { harnessPanelKind } from '@pkgs/harness-console-shared-ts/harness-windows';
import type {
  ProductHarnessPaletteCommand,
  ProductHarnessSession,
} from '@pkgs/harness-console-shared-ts/ports';
import { WindowManager } from '@pkgs/ui-devtools-client-ts/window-manager';
import { CommandPalette } from '@pkgs/ui-root-client-ts/command-palette';
import { CommandRegistryProvider } from '@pkgs/ui-root-client-ts/command-registry-context';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import {
  Columns2Icon,
  RotateCcwIcon,
  SquareStackIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { OverlayPortalProvider } from '@pkgs/ui-root-client-ts/overlay-portal';
import { Pane } from '@pkgs/ui-root-client-ts/pane';
import { RegisterCommand } from '@pkgs/ui-root-client-ts/register-command';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { useTheme } from '@pkgs/ui-root-client-ts/theme-context';
import { Toolbar } from '@pkgs/ui-root-client-ts/toolbar';
import {
  createMemo,
  createSignal,
  For,
  type JSX,
  Match,
  Switch,
} from 'solid-js';
import type { HarnessConsoleNav } from './debugger-chrome';
import { harnessWindowPanel } from './harness-node-window';
import { ProductHarnessAppearanceCommands } from './product-harness-appearance-commands';
import {
  ProductHarnessExitButton,
  ProductHarnessExitCommand,
} from './product-harness-exit';
import { ProductHarnessSnapshotChrome } from './product-harness-snapshot-chrome';
import { ProductHarnessTopologyChrome } from './product-harness-topology-chrome';
import { type HarnessWindows, useHarnessWindows } from './use-harness-windows';
import type { ProductHarnessSessionState } from './use-product-harness-session';

export function ProductHarnessScreen(props: {
  readonly state: ProductHarnessSessionState;
  readonly nav: HarnessConsoleNav;
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
        <CenteredState>
          <ErrorState
            title="Failed to boot harness"
            body={props.state.status === 'error' ? props.state.error : ''}
            {...(props.onReload !== undefined
              ? { retry: { label: 'Reload', onClick: props.onReload } }
              : {})}
          />
        </CenteredState>
      </Match>
      <Match when={readyState() === null}>
        <CenteredState>
          <LoadingState caption="Booting harness…" />
        </CenteredState>
      </Match>
      <Match when={readyState()}>
        {(state) => (
          <OverlayPortalProvider>
            <SurfaceStackProvider>
              <ReadyProductHarnessScreen
                session={state().session}
                nav={props.nav}
                onExit={props.onExit}
              />
            </SurfaceStackProvider>
          </OverlayPortalProvider>
        )}
      </Match>
    </Switch>
  );
}

/** Boot status block, centered on the canvas fill. */
function CenteredState(props: { readonly children: JSX.Element }) {
  return (
    <Surface
      tone="background"
      grow
      align="center"
      justify="center"
      padding="lg"
    >
      {props.children}
    </Surface>
  );
}

type LayoutAction = {
  readonly id: string;
  readonly title: string;
  readonly icon: typeof Columns2Icon;
  readonly keywords: readonly string[];
  readonly run: () => void;
};

/** Whole-console arrangements, offered in the palette and every window menu. */
function layoutActions(windows: HarnessWindows): readonly LayoutAction[] {
  return [
    {
      id: 'harness-layout-beside',
      title: 'Show clients side by side',
      icon: Columns2Icon,
      keywords: ['columns', 'clients', 'layout', 'split', 'windows'],
      run: () => windows.arrange('beside'),
    },
    {
      id: 'harness-layout-tabs',
      title: 'Tab clients in one window',
      icon: SquareStackIcon,
      keywords: ['tabs', 'clients', 'layout', 'stack', 'windows'],
      run: () => windows.arrange('tabs'),
    },
    {
      id: 'harness-layout-reset',
      title: 'Reset window layout',
      icon: RotateCcwIcon,
      keywords: ['reset', 'default', 'layout', 'windows', 'panels'],
      run: windows.reset,
    },
  ];
}

function HarnessLayoutCommands(props: {
  readonly actions: readonly LayoutAction[];
}): JSX.Element {
  return (
    <For each={props.actions}>
      {(action) => (
        <RegisterCommand
          id={action.id}
          title={action.title}
          category="Appearance"
          icon={action.icon}
          keywords={[...action.keywords]}
          run={async () => {
            action.run();
          }}
        />
      )}
    </For>
  );
}

/**
 * The console: harness controls over a window manager with one panel per
 * node. A client's app owns the keyboard while its panel is the focused
 * one; the harness's own shortcuts apply otherwise, and after a press on
 * the controls until the windows are used again.
 */
function ReadyProductHarnessScreen(props: {
  readonly session: ProductHarnessSession;
  readonly nav: HarnessConsoleNav;
  readonly onExit: () => void;
}) {
  const theme = useTheme();
  const windows = useHarnessWindows(() => props.session, props.nav);
  const [controlsActive, setControlsActive] = createSignal(false);
  const keyboardPanel = createMemo(() => {
    const panel = windows.focusedPanel();
    return controlsActive() || panel === null ? null : panel;
  });
  const clientOwnsKeyboard = () => {
    const panel = keyboardPanel();
    return panel !== null && harnessPanelKind(panel) === 'client';
  };
  const panels = createMemo(() =>
    windows.panels().map((panel) =>
      harnessWindowPanel(panel, {
        session: () => props.session,
        revision: windows.revision,
        nav: props.nav,
        keyboardPanel,
      })
    )
  );
  const paletteCommands = createMemo(() => {
    windows.revision();
    return props.session.listPaletteCommands();
  });
  const actions = layoutActions(windows);
  return (
    <CommandRegistryProvider enableDefaultShortcuts={!clientOwnsKeyboard()}>
      <ProductHarnessAppearanceCommands />
      <ProductHarnessExitCommand onExit={props.onExit} />
      <HarnessLayoutCommands actions={actions} />
      <ProductHarnessPaletteRegistrations commands={paletteCommands()} />
      <Surface tone="background" grow overflow="hidden">
        <Pane
          grow={false}
          clip={false}
          onActivate={() => setControlsActive(true)}
        >
          <Toolbar
            density="regular"
            justify="end"
            aria-label="Harness controls"
          >
            <ProductHarnessTopologyChrome session={props.session} />
            <ProductHarnessSnapshotChrome session={props.session} />
            <ProductHarnessExitButton onExit={props.onExit} />
          </Toolbar>
        </Pane>
        <Pane tone="background" onActivate={() => setControlsActive(false)}>
          <WindowManager
            aria-label="Harness nodes"
            panels={panels()}
            layout={windows.layout()}
            onLayoutChange={windows.onLayoutChange}
            compact={theme.breakpoint() === 'mobile'}
            menuActions={actions.map((action, at) => ({
              id: action.id,
              label: action.title,
              icon: action.icon,
              onClick: action.run,
              endsGroup: at === actions.length - 1,
            }))}
          />
        </Pane>
      </Surface>
      <CommandPalette />
    </CommandRegistryProvider>
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
