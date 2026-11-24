import {
  HARNESS_APP_VIEW,
  type HarnessPanelRef,
  harnessEmulatorPanelId,
} from '@pkgs/harness-console-shared-ts/harness-windows';
import type {
  ProductHarnessEmulatorElement,
  ProductHarnessPaletteCommand,
  ProductHarnessSession,
} from '@pkgs/harness-console-shared-ts/ports';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { CommandPalette } from '@pkgs/ui-root-client-ts/command-palette';
import { CommandRegistryProvider } from '@pkgs/ui-root-client-ts/command-registry-context';
import { EmbeddedFrame } from '@pkgs/ui-root-client-ts/embedded-frame';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { OverlayPortalProvider } from '@pkgs/ui-root-client-ts/overlay-portal';
import { RegisterCommand } from '@pkgs/ui-root-client-ts/register-command';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { useCommandPalette } from '@pkgs/ui-root-client-ts/use-command-palette';
import type { JSX } from '@solidjs/web';
import {
  type Accessor,
  type Component,
  createMemo,
  createSignal,
  For,
  Match,
  onCleanup,
  Show,
  Switch,
  untrack,
} from 'solid-js';
import type { HarnessConsoleNav } from './debugger-chrome';
import { HarnessHome, type HarnessHomeTool } from './harness-home';
import {
  type HarnessNodeWindowContext,
  HarnessPanelView,
} from './harness-node-window';
import { ProductHarnessAppearanceCommands } from './product-harness-appearance-commands';
import { ProductHarnessSnapshotSurface } from './product-harness-snapshot-chrome';
import { ProductHarnessTopologySurface } from './product-harness-topology-chrome';
import { useHarnessView } from './use-harness-view';
import type { ProductHarnessSessionState } from './use-product-harness-session';

export type PreviewShellProps = {
  readonly initial: string;
  readonly apps: readonly {
    readonly id: string;
    readonly label: string;
    readonly content: (active: Accessor<boolean>) => JSX.Element;
  }[];
};

export function ProductHarnessScreen(props: {
  readonly state: ProductHarnessSessionState;
  readonly nav: HarnessConsoleNav;
  readonly shell: Component<PreviewShellProps>;
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
                shell={props.shell}
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

function ReadyProductHarnessScreen(props: {
  readonly session: ProductHarnessSession;
  readonly nav: HarnessConsoleNav;
  readonly shell: Component<PreviewShellProps>;
}) {
  const emulators = () => emulatorViews(props.session);
  const view = useHarnessView(
    () => props.session,
    () => props.nav,
    () => emulators().map((e) => e.id)
  );
  const context = (
    keyboardPanel: Accessor<string | null>
  ): HarnessNodeWindowContext => ({
    session: () => props.session,
    revision: view.revision,
    nav: () => props.nav,
    keyboardPanel,
  });
  // Mockingbird takes its surface list at mount. Later arrivals are inspectable
  // in the Instances surface until the next boot.
  const nodes = untrack(view.panels);
  const dashboards = untrack(emulators);
  const fixedIds = new Set([...nodes, ...dashboards].map((item) => item.id));
  const extraPanels = () =>
    view.panels().filter((panel) => !fixedIds.has(panel.id));
  const extraEmulators = createMemo(() => {
    view.revision();
    return emulators().filter((item) => !fixedIds.has(item.id));
  });
  const apps: PreviewShellProps['apps'] = [
    ...nodes.map((panel) => ({
      id: panel.id,
      label: panel.title,
      content: (active: Accessor<boolean>) => (
        <HarnessPanelView
          panel={panel}
          context={context(() => (active() ? panel.id : null))}
        />
      ),
    })),
    ...dashboards.map((emulator) => ({
      id: emulator.id,
      label: emulator.title,
      content: () => <EmulatorDashboard emulator={emulator} />,
    })),
    {
      id: 'instances',
      label: 'Instances',
      content: (active) => (
        <SessionInspector
          session={props.session}
          context={context(() => (active() ? props.nav.show : null))}
          panels={extraPanels()}
          emulators={extraEmulators()}
          show={view.show}
          active={active()}
        />
      ),
    },
  ];
  const wanted = untrack(view.shownId);
  return (
    <props.shell
      apps={apps}
      initial={wanted && fixedIds.has(wanted) ? wanted : 'instances'}
    />
  );
}

function SessionInspector(props: {
  readonly session: ProductHarnessSession;
  readonly context: HarnessNodeWindowContext;
  readonly panels: readonly HarnessPanelRef[];
  readonly emulators: readonly EmulatorView[];
  readonly show: (id: string) => void;
  readonly active: boolean;
}) {
  const [controls, setControls] = createSignal<HarnessControls | null>(null);
  const commands = createMemo(() => {
    props.context.revision();
    return props.session.listPaletteCommands();
  });
  const selected = () =>
    props.panels.find((panel) => panel.id === props.context.nav().show);
  const dashboard = () =>
    props.emulators.find((item) => item.id === props.context.nav().show);
  return (
    <CommandRegistryProvider
      enableDefaultShortcuts={props.active && selected()?.kind !== 'client'}
    >
      <ProductHarnessAppearanceCommands />
      <ProductHarnessPaletteRegistrations commands={commands()} />
      <Show when={selected() || dashboard()}>
        <Button
          title="Instances"
          onClick={() => props.show(HARNESS_APP_VIEW)}
        />
      </Show>
      <Switch
        fallback={
          <SessionTools
            panels={props.panels}
            emulators={props.emulators}
            onShow={props.show}
            onOpen={setControls}
          />
        }
      >
        <Match when={selected()} keyed>
          {(panel) => (
            <HarnessPanelView panel={panel} context={props.context} />
          )}
        </Match>
        <Match when={dashboard()} keyed>
          {(item) => <EmulatorDashboard emulator={item} />}
        </Match>
      </Switch>
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

function SessionTools(
  props: Omit<Parameters<typeof HarnessHome>[0], 'onOpen'> & {
    readonly onOpen: (tool: Exclude<HarnessHomeTool, 'commands'>) => void;
  }
) {
  const palette = useCommandPalette();
  return (
    <HarnessHome
      panels={props.panels}
      emulators={props.emulators}
      onShow={props.onShow}
      onOpen={(tool) => {
        if (tool === 'commands') palette.open();
        else props.onOpen(tool);
      }}
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
