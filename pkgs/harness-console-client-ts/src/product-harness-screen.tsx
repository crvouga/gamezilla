import {
  HARNESS_APP_VIEW,
  HARNESS_SWITCH_KEYS,
  type HarnessPanelRef,
  harnessEmulatorPanelId,
  harnessPanelId,
  harnessSwitchOf,
  harnessSwitchTarget,
} from '@pkgs/harness-console-shared-ts/harness-windows';
import type {
  ProductHarnessPaletteCommand,
  ProductHarnessSession,
} from '@pkgs/harness-console-shared-ts/ports';
import {
  AppStage,
  type AppStageView,
} from '@pkgs/ui-devtools-client-ts/app-stage';
import { CommandPalette } from '@pkgs/ui-root-client-ts/command-palette';
import { CommandRegistryProvider } from '@pkgs/ui-root-client-ts/command-registry-context';
import { EmbeddedFrame } from '@pkgs/ui-root-client-ts/embedded-frame';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import {
  ArrowLeftRightIcon,
  PlusIcon,
  SlidersHorizontalIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { OverlayPortalProvider } from '@pkgs/ui-root-client-ts/overlay-portal';
import { RegisterCommand } from '@pkgs/ui-root-client-ts/register-command';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { useCommandPalette } from '@pkgs/ui-root-client-ts/use-command-palette';
import { useDocumentShortcuts } from '@pkgs/ui-root-client-ts/use-document-shortcuts';
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  Match,
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
 * running while another is on show, as a phone left on a table does; the
 * harness's own app, a node behind the apps, or an emulator's dashboard,
 * opens when first looked at.
 */
function stageViews(
  panels: readonly HarnessPanelRef[],
  emulators: readonly EmulatorView[],
  context: HarnessNodeWindowContext,
  home: () => JSX.Element
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
    { id: HARNESS_APP_VIEW, title: 'Harness', content: home },
  ];
}

/** What a view is called: a node's panel, an emulator, or the harness app. */
function viewTitle(
  id: string | null,
  panels: readonly HarnessPanelRef[],
  emulators: readonly EmulatorView[]
): string {
  if (id === HARNESS_APP_VIEW) return 'Harness';
  return (
    panels.find((panel) => panel.id === id)?.title ??
    emulators.find((emulator) => emulator.id === id)?.title ??
    'Nothing'
  );
}

/**
 * Switching apps from the keyboard, whatever is on show: a client's app owns
 * every other key while it is, and these are the way out of it.
 */
function useSwitchKeys(view: HarnessView): void {
  useDocumentShortcuts({
    enabled: () => true,
    onKeyDown: (event) => {
      const asked = event.repeat ? null : harnessSwitchOf(event);
      if (asked === null) return false;
      view.switchTo(asked);
      return true;
    },
  });
}

/**
 * The console: one app at a time, edge to edge, and one small button over
 * it that switches to the next: each client's app, then the harness's own,
 * where the world is set up and everything behind the apps is opened from.
 * A client's app owns the keyboard while it is on show, but for the keys
 * that switch apps; the harness's other shortcuts apply otherwise, and
 * while one of its surfaces is open.
 */
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
  useSwitchKeys(view);
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
    stageViews(view.panels(), emulators(), context, () => (
      <HarnessHomeApp
        view={view}
        emulators={emulators}
        onOpen={(tool) => setControls(tool)}
      />
    ))
  );
  const label = createMemo(() => {
    const ids = [
      ...view.panels().map((panel) => panel.id),
      ...emulators().map((emulator) => emulator.id),
      HARNESS_APP_VIEW,
    ];
    const title = (id: string | null) =>
      viewTitle(id, view.panels(), emulators());
    const next = harnessSwitchTarget({ to: 'next' }, view.shownId(), ids);
    return `${title(view.shownId())} is on show. Switch to ${title(next)}.`;
  });
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
        <AppStage
          aria-label="Harness"
          shown={view.shownId()}
          views={views()}
          handle={{
            label: label(),
            onTap: () => view.switchTo({ to: 'next' }),
          }}
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
        id="harness-next-app"
        title="Switch to the next app"
        category="Harness"
        icon={ArrowLeftRightIcon}
        keywords={['next', 'client', 'switch', 'cycle', 'app']}
        shortcut={HARNESS_SWITCH_KEYS.next}
        run={async () => {
          props.view.switchTo({ to: 'next' });
        }}
      />
      <RegisterCommand
        id="harness-previous-app"
        title="Switch to the previous app"
        category="Harness"
        icon={ArrowLeftRightIcon}
        keywords={['previous', 'back', 'client', 'switch', 'cycle', 'app']}
        shortcut={HARNESS_SWITCH_KEYS.previous}
        run={async () => {
          props.view.switchTo({ to: 'previous' });
        }}
      />
      <RegisterCommand
        id="harness-show-harness"
        title="Show the harness app"
        category="Harness"
        icon={SlidersHorizontalIcon}
        keywords={['harness', 'configure', 'setup', 'settings', 'menu']}
        shortcut={HARNESS_SWITCH_KEYS.harness}
        run={async () => {
          props.view.switchTo({ to: 'harness' });
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
