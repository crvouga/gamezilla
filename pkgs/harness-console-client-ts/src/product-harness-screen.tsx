import {
  HARNESS_APP_VIEW,
  type HarnessPanelRef,
  harnessEmulatorPanelId,
  harnessPanelId,
} from '@pkgs/harness-console-shared-ts/harness-windows';
import type {
  ProductHarnessEmulatorElement,
  ProductHarnessPaletteCommand,
  ProductHarnessSession,
} from '@pkgs/harness-console-shared-ts/ports';
import {
  AppStage,
  type AppStageView,
} from '@pkgs/ui-devtools-client-ts/app-stage';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { CommandPalette } from '@pkgs/ui-root-client-ts/command-palette';
import { CommandRegistryProvider } from '@pkgs/ui-root-client-ts/command-registry-context';
import { EmbeddedFrame } from '@pkgs/ui-root-client-ts/embedded-frame';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { PlusIcon } from '@pkgs/ui-root-client-ts/icons';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { OverlayPortalProvider } from '@pkgs/ui-root-client-ts/overlay-portal';
import { RegisterCommand } from '@pkgs/ui-root-client-ts/register-command';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { useCommandPalette } from '@pkgs/ui-root-client-ts/use-command-palette';
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  Match,
  onCleanup,
  Show,
  Switch,
} from 'solid-js';
import type { HarnessConsoleNav } from './debugger-chrome';
import { HarnessHome, type HarnessHomeTool } from './harness-home';
import {
  type HarnessNodeWindowContext,
  HarnessPanelView,
} from './harness-node-window';
import { harnessNodeIcon } from './node-chrome';
import { ProductHarnessAppearanceCommands } from './product-harness-appearance-commands';
import { ProductHarnessSnapshotSurface } from './product-harness-snapshot-chrome';
import { ProductHarnessTopologySurface } from './product-harness-topology-chrome';
import { type HarnessView, useHarnessView } from './use-harness-view';
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

/** The harness's own controls, each a surface its app opens. */
type HarnessControls = 'nodes' | 'snapshots';

/** An emulator's dashboard, as a view of its own beside the panels. */
type EmulatorView = {
  /** The view's id (`emulator:google`). */
  readonly id: string;
  readonly title: string;
  /** Where a frame loads it from, or how it is opened in this page. */
  readonly from: string | (() => ProductHarnessEmulatorElement);
};

function emulatorViews(session: ProductHarnessSession): EmulatorView[] {
  return session.emulators.flatMap((emulator) => {
    const from = emulator.dashboardUrl ?? emulator.open;
    return from === undefined
      ? []
      : [
          {
            id: harnessEmulatorPanelId(emulator.id),
            title: emulator.title,
            from,
          },
        ];
  });
}

/** An emulator's dashboard: a frame on its address, or its own element. */
function EmulatorDashboard(props: {
  readonly emulator: EmulatorView;
}): JSX.Element {
  const from = props.emulator.from;
  if (typeof from === 'string')
    return <EmbeddedFrame title={props.emulator.title} src={from} />;
  const opened = from();
  onCleanup(opened.dispose);
  return (
    <EmbeddedFrame title={props.emulator.title}>{opened.element}</EmbeddedFrame>
  );
}

/**
 * Every view of the stage. A client's app runs from the start and keeps
 * running while another is on show, as a phone left on a table does; the
 * harness's own app, any other instance, or an emulator's dashboard, opens
 * when first looked at.
 */
function panelViews(
  previous: readonly AppStageView[],
  panels: readonly HarnessPanelRef[],
  context: HarnessNodeWindowContext
): AppStageView[] {
  const mounted = new Map(previous.map((view) => [view.id, view]));
  return panels.map(
    (panel) =>
      mounted.get(panel.id) ?? {
        id: panel.id,
        title: panel.title,
        live: panel.kind === 'client',
        content: () => <HarnessPanelView panel={panel} context={context} />,
      }
  );
}

function ReadyProductHarnessScreen(props: {
  readonly session: ProductHarnessSession;
  readonly nav: HarnessConsoleNav;
}) {
  const [controls, setControls] = createSignal<HarnessControls | null>(null);
  // Read again whenever the harness app is looked at: a payment provider
  // can boot later.
  const [looked, setLooked] = createSignal(0);
  const emulators = createMemo(() => {
    looked();
    return emulatorViews(props.session);
  });
  const view = useHarnessView(
    () => props.session,
    () => props.nav,
    () => emulators().map((emulator) => emulator.id)
  );
  createEffect(() => {
    if (view.shownId() === HARNESS_APP_VIEW) setLooked((count) => count + 1);
  });
  const keyboardPanel = createMemo(() =>
    controls() === null ? (view.shown()?.id ?? null) : null
  );
  const clientOwnsKeyboard = () => view.shown()?.kind === 'client';
  const context: HarnessNodeWindowContext = {
    session: () => props.session,
    revision: view.revision,
    nav: () => props.nav,
    keyboardPanel,
  };
  const panels = createMemo<AppStageView[]>(
    (previous) => panelViews(previous, view.panels(), context),
    []
  );
  const home = {
    id: HARNESS_APP_VIEW,
    title: 'Instances',
    content: () => (
      <HarnessHomeApp view={view} emulators={emulators} onOpen={setControls} />
    ),
  };
  const views = createMemo(() => [
    ...panels(),
    ...emulators().map((emulator) => ({
      id: emulator.id,
      title: emulator.title,
      content: () => <EmulatorDashboard emulator={emulator} />,
    })),
    home,
  ]);
  const paletteCommands = createMemo(() => {
    view.revision();
    return props.session.listPaletteCommands();
  });
  const addClient = (): void =>
    void props.session
      .addClient()
      .then((actor) => view.show(harnessPanelId('client', actor.id)))
      .catch(() => undefined);
  return (
    <CommandRegistryProvider
      enableDefaultShortcuts={controls() !== null || !clientOwnsKeyboard()}
    >
      <ProductHarnessAppearanceCommands />
      <HarnessViewCommands view={view} onAddClient={addClient} />
      <ProductHarnessPaletteRegistrations commands={paletteCommands()} />
      <Surface tone="background" grow overflow="hidden">
        <Show when={view.shownId() !== HARNESS_APP_VIEW}>
          <Button
            title="Instances"
            onClick={() => view.show(HARNESS_APP_VIEW)}
          />
        </Show>
        <AppStage aria-label="Harness" shown={view.shownId()} views={views()} />
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

/** The harness's own app, opening its tools; under the command registry. */
function HarnessHomeApp(props: {
  readonly view: HarnessView;
  readonly emulators: () => readonly EmulatorView[];
  readonly onOpen: (tool: Exclude<HarnessHomeTool, 'commands'>) => void;
}): JSX.Element {
  const palette = useCommandPalette();
  return (
    <HarnessHome
      panels={props.view.panels()}
      emulators={props.emulators()}
      onShow={props.view.show}
      onOpen={(tool) => {
        if (tool === 'commands') palette.open();
        else props.onOpen(tool);
      }}
    />
  );
}

/** Moving between views from the palette, for a keyboard. */
function HarnessViewCommands(props: {
  readonly view: HarnessView;
  readonly onAddClient: () => void;
}): JSX.Element {
  return (
    <>
      <RegisterCommand
        id="harness-add-client"
        title="Add a client"
        category="Harness"
        icon={PlusIcon}
        keywords={['add', 'client', 'new', 'device']}
        run={async () => {
          props.onAddClient();
        }}
      />
      <For each={props.view.panels()}>
        {(panel) => (
          <RegisterCommand
            id={`harness-show-${panel.id}`}
            title={`Show ${panel.title}`}
            category="Harness"
            icon={harnessNodeIcon(panel.kind)}
            keywords={['show', 'open', 'panel', panel.kind, panel.title]}
            run={async () => {
              props.view.show(panel.id);
            }}
          />
        )}
      </For>
    </>
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
