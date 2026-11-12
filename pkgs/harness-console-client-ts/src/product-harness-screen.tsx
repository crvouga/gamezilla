import {
  type HarnessPanelRef,
  harnessEmulatorPanelId,
  harnessPanelId,
} from '@pkgs/harness-console-shared-ts/harness-windows';
import type {
  ProductHarnessPaletteCommand,
  ProductHarnessSession,
} from '@pkgs/harness-console-shared-ts/ports';
import {
  AppStage,
  type AppStageView,
} from '@pkgs/ui-devtools-client-ts/app-stage';
import type { AppStageHandleProps } from '@pkgs/ui-devtools-client-ts/app-stage-handle';
import { CommandPalette } from '@pkgs/ui-root-client-ts/command-palette';
import { CommandRegistryProvider } from '@pkgs/ui-root-client-ts/command-registry-context';
import { EmbeddedFrame } from '@pkgs/ui-root-client-ts/embedded-frame';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import {
  FlaskConicalIcon,
  MonitorIcon,
  PlusIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { OverlayPortalProvider } from '@pkgs/ui-root-client-ts/overlay-portal';
import { RegisterCommand } from '@pkgs/ui-root-client-ts/register-command';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
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
import { HarnessDevMenu } from './harness-dev-menu';
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

/** The harness's own controls, each a surface opened from its menu. */
type HarnessControls = 'menu' | 'nodes' | 'snapshots';

/** An emulator's dashboard, as a view of its own beside the panels. */
type EmulatorView = {
  /** The view's id (`emulator:google`). */
  readonly id: string;
  readonly title: string;
  readonly url: string;
};

function emulatorViews(session: ProductHarnessSession): EmulatorView[] {
  return session.emulators.flatMap((emulator) =>
    emulator.dashboardUrl === null
      ? []
      : [
          {
            id: harnessEmulatorPanelId(emulator.id),
            title: emulator.title,
            url: emulator.dashboardUrl,
          },
        ]
  );
}

/**
 * Every view of the stage. A client's app runs from the start and keeps
 * running while another is on show, as a phone left on a table does; a node
 * behind the apps, or an emulator's dashboard, opens when first looked at.
 */
function stageViews(
  panels: readonly HarnessPanelRef[],
  emulators: readonly EmulatorView[],
  context: HarnessNodeWindowContext
): AppStageView[] {
  return [
    ...panels.map(
      (panel): AppStageView => ({
        id: panel.id,
        title: panel.title,
        live: panel.kind === 'client',
        content: () => <HarnessPanelView panel={panel} context={context} />,
      })
    ),
    ...emulators.map(
      (emulator): AppStageView => ({
        id: emulator.id,
        title: emulator.title,
        content: () => (
          <EmbeddedFrame title={emulator.title} src={emulator.url} />
        ),
      })
    ),
  ];
}

/**
 * What the button says of what is on show: a client by its initials, a node
 * behind the apps or an emulator by an icon.
 */
function handleFace(
  panel: HarnessPanelRef | null,
  emulator: EmulatorView | undefined
): Pick<AppStageHandleProps, 'label' | 'text' | 'icon'> {
  const showing = panel?.title ?? emulator?.title ?? 'Nothing';
  const label = `${showing} is on show. Press for the next client, hold or press Down for the harness menu.`;
  if (panel?.kind === 'client') return { label, text: panel.title.slice(0, 2) };
  return {
    label,
    icon: panel === null ? FlaskConicalIcon : harnessNodeIcon(panel.kind),
  };
}

/**
 * The console: one app at a time, edge to edge, and one small button over
 * it. A tap on the button goes on to the next client's app; holding it opens
 * the menu, with every client and every node behind the apps by name and
 * the harness's own tools. A client's app owns the keyboard while it is on
 * show; the harness's shortcuts apply otherwise, and while one of its
 * surfaces is open.
 */
function ReadyProductHarnessScreen(props: {
  readonly session: ProductHarnessSession;
  readonly nav: HarnessConsoleNav;
}) {
  const [controls, setControls] = createSignal<HarnessControls | null>(null);
  const [busy, setBusy] = createSignal(false);
  // Read again whenever the menu opens: a payment provider can boot later.
  const emulators = createMemo(() => {
    controls();
    return emulatorViews(props.session);
  });
  const view = useHarnessView(
    () => props.session,
    () => props.nav,
    () => emulators().map((emulator) => emulator.id)
  );
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
  const views = createMemo(() =>
    stageViews(view.panels(), emulators(), context)
  );
  const face = createMemo(() =>
    handleFace(
      view.shown(),
      emulators().find((emulator) => emulator.id === view.shownId())
    )
  );
  const paletteCommands = createMemo(() => {
    view.revision();
    return props.session.listPaletteCommands();
  });
  const change = (work: Promise<unknown>): void => {
    setBusy(true);
    void work.catch(() => undefined).finally(() => setBusy(false));
  };
  const addClient = (): void =>
    change(
      props.session
        .addClient()
        .then((actor) => view.show(harnessPanelId('client', actor.id)))
    );
  const removeClient = (id: string): void =>
    change(props.session.removeClient(id));
  return (
    <CommandRegistryProvider
      enableDefaultShortcuts={controls() !== null || !clientOwnsKeyboard()}
    >
      <ProductHarnessAppearanceCommands />
      <HarnessViewCommands view={view} onAddClient={addClient} />
      <ProductHarnessPaletteRegistrations commands={paletteCommands()} />
      <Surface tone="background" grow overflow="hidden">
        <AppStage
          aria-label="Harness"
          shown={view.shownId()}
          views={views()}
          handle={{
            ...face(),
            expanded: controls() === 'menu',
            onTap: view.next,
            onHold: () => setControls('menu'),
          }}
        />
      </Surface>
      <HarnessControlSurfaces
        session={props.session}
        view={view}
        emulators={emulators()}
        controls={controls()}
        busy={busy()}
        setControls={setControls}
        onAddClient={addClient}
        onRemoveClient={removeClient}
      />
      <CommandPalette />
    </CommandRegistryProvider>
  );
}

/** The menu and the surfaces it opens; under the command registry. */
function HarnessControlSurfaces(props: {
  readonly session: ProductHarnessSession;
  readonly view: HarnessView;
  readonly emulators: readonly EmulatorView[];
  readonly controls: HarnessControls | null;
  readonly busy: boolean;
  readonly setControls: (controls: HarnessControls | null) => void;
  readonly onAddClient: () => void;
  readonly onRemoveClient: (id: string) => void;
}): JSX.Element {
  const palette = useCommandPalette();
  const close = (): void => props.setControls(null);
  return (
    <>
      <HarnessDevMenu
        open={props.controls === 'menu'}
        onClose={close}
        panels={props.view.panels()}
        emulators={props.emulators}
        shown={props.view.shownId()}
        busy={props.busy}
        onShow={props.view.show}
        onRemoveClient={props.onRemoveClient}
        onAction={(action) => {
          if (action === 'add-client') props.onAddClient();
          else if (action === 'commands') palette.open();
          else props.setControls(action);
        }}
      />
      <ProductHarnessTopologySurface
        session={props.session}
        open={props.controls === 'nodes'}
        onClose={close}
      />
      <ProductHarnessSnapshotSurface
        session={props.session}
        open={props.controls === 'snapshots'}
        onClose={close}
      />
    </>
  );
}

/** Moving between panels from the palette, for a keyboard. */
function HarnessViewCommands(props: {
  readonly view: HarnessView;
  readonly onAddClient: () => void;
}): JSX.Element {
  return (
    <>
      <RegisterCommand
        id="harness-next-client"
        title="Show the next client"
        category="Harness"
        icon={MonitorIcon}
        keywords={['next', 'client', 'switch', 'cycle', 'app']}
        run={async () => {
          props.view.next();
        }}
      />
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
