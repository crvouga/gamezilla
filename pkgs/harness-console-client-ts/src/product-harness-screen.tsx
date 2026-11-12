import { useTimers } from '@pkgs/clock-client-ts/solid';
import { harnessPanelKind } from '@pkgs/harness-console-shared-ts/harness-windows';
import type {
  ProductHarnessPaletteCommand,
  ProductHarnessSession,
} from '@pkgs/harness-console-shared-ts/ports';
import { WindowManager } from '@pkgs/ui-devtools-client-ts/window-manager';
import type { WindowPanel } from '@pkgs/ui-devtools-client-ts/window-manager-types';
import { CommandPalette } from '@pkgs/ui-root-client-ts/command-palette';
import { CommandRegistryProvider } from '@pkgs/ui-root-client-ts/command-registry-context';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import {
  Columns2Icon,
  RotateCcwIcon,
  SaveIcon,
  SearchIcon,
  ServerIcon,
  SquareStackIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import type { OverflowMenuAction } from '@pkgs/ui-root-client-ts/overflow-menu-button';
import { OverlayPortalProvider } from '@pkgs/ui-root-client-ts/overlay-portal';
import { RegisterCommand } from '@pkgs/ui-root-client-ts/register-command';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { useTheme } from '@pkgs/ui-root-client-ts/theme-context';
import { useCommandPalette } from '@pkgs/ui-root-client-ts/use-command-palette';
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
import { ProductHarnessSnapshotSurface } from './product-harness-snapshot-chrome';
import { ProductHarnessTopologySurface } from './product-harness-topology-chrome';
import { type HarnessWindows, useHarnessWindows } from './use-harness-windows';
import type { ProductHarnessSessionState } from './use-product-harness-session';

export function ProductHarnessScreen(props: {
  readonly state: ProductHarnessSessionState;
  readonly nav: HarnessConsoleNav;
  /** Retry boot after an error (chunk load / harness init). */
  readonly onReload?: () => void;
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
 * The console: a window manager with one panel per node, and nothing above
 * it. A client's app owns the keyboard while its panel is the focused one;
 * the harness's own shortcuts apply otherwise, and while one of its controls
 * surfaces is open.
 */
function ReadyProductHarnessScreen(props: {
  readonly session: ProductHarnessSession;
  readonly nav: HarnessConsoleNav;
}) {
  const windows = useHarnessWindows(
    () => props.session,
    () => props.nav,
    useTimers()
  );
  const keyboardPanel = createMemo(() => windows.focusedPanel());
  const panels = createMemo(() =>
    windows.panels().map((panel) =>
      harnessWindowPanel(panel, {
        session: () => props.session,
        revision: windows.revision,
        nav: () => props.nav,
        keyboardPanel,
      })
    )
  );
  const paletteCommands = createMemo(() => {
    windows.revision();
    return props.session.listPaletteCommands();
  });
  const [controls, setControls] = createSignal<HarnessControls | null>(null);
  // An open controls surface has the keyboard, whichever panel has focus.
  const clientOwnsKeyboard = () => {
    const panel = controls() === null ? keyboardPanel() : null;
    return panel !== null && harnessPanelKind(panel) === 'client';
  };
  return (
    <CommandRegistryProvider enableDefaultShortcuts={!clientOwnsKeyboard()}>
      <ProductHarnessAppearanceCommands />
      <HarnessLayoutCommands actions={layoutActions(windows)} />
      <ProductHarnessPaletteRegistrations commands={paletteCommands()} />
      <Surface tone="background" grow overflow="hidden">
        <HarnessWindowManager
          windows={windows}
          panels={panels()}
          onControls={setControls}
        />
      </Surface>
      <ProductHarnessTopologySurface
        session={props.session}
        open={controls() === 'nodes'}
        onClose={() => setControls(null)}
      />
      <ProductHarnessSnapshotSurface
        session={props.session}
        open={controls() === 'snapshots'}
        onClose={() => setControls(null)}
      />
      <CommandPalette />
    </CommandRegistryProvider>
  );
}

/** The harness's own controls, each a surface opened from a window's menu. */
type HarnessControls = 'nodes' | 'snapshots';

/**
 * The windows fill the screen: each window's tab bar is the only bar there
 * is. What the harness itself offers (its nodes, its snapshots, its
 * commands, the arrangements) is in every window's menu.
 */
function HarnessWindowManager(props: {
  readonly windows: HarnessWindows;
  readonly panels: readonly WindowPanel[];
  readonly onControls: (controls: HarnessControls) => void;
}): JSX.Element {
  const theme = useTheme();
  const palette = useCommandPalette();
  const menuActions = createMemo((): readonly OverflowMenuAction[] => {
    const layout = layoutActions(props.windows);
    return [
      ...layout.map((action) => ({
        id: action.id,
        label: action.title,
        icon: action.icon,
        onClick: action.run,
        endsGroup: action === layout.at(-1),
      })),
      {
        id: 'harness-nodes',
        label: 'Nodes',
        icon: ServerIcon,
        onClick: () => props.onControls('nodes'),
      },
      {
        id: 'harness-snapshots',
        label: 'Snapshots',
        icon: SaveIcon,
        onClick: () => props.onControls('snapshots'),
      },
      {
        id: 'harness-commands',
        label: 'Commands',
        icon: SearchIcon,
        onClick: palette.open,
      },
    ];
  });
  return (
    <WindowManager
      aria-label="Harness nodes"
      panels={[...props.panels]}
      layout={props.windows.layout()}
      onLayoutChange={props.windows.onLayoutChange}
      compact={theme.breakpoint() === 'mobile'}
      menuActions={menuActions()}
    />
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
