import type { JSX } from 'solid-js';

import type { SimConsolePorts } from '../shared/ports';
import type { SimChromeKind } from '../shared/sim-node';
import { ClientLayoutPreferenceProvider } from './debugger/client-layout-preference';
import type { PaneNavPatch, PaneNavValue } from './debugger-chrome';
import { ProductSimulatorScreen } from './product-simulator/product-simulator-screen';
import { useProductSimulatorSession } from './product-simulator/use-product-simulator-session';
import { NotebookStoreProvider } from './sql-notebook/notebook-store-context';
import { appShellSx } from './tokens';

/**
 * Simulator screen root — a flat sibling of the product app, no chrome of
 * its own beyond the debugger. `onExit` leaves for the app (also exposed as
 * the "Exit simulator" palette command and toolbar button).
 *
 * Simulator nav is controlled by the host so it can sync to browser history.
 * Test reports are standalone HTML artifacts (`@pkgs/sim` `writeHtmlReport`),
 * not a screen here.
 */
export function SimConsoleApp(props: {
  readonly ports: SimConsolePorts;
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
  readonly onExit: () => void;
}): JSX.Element {
  const session = useProductSimulatorSession(
    (opts) => props.ports.bootProductSimulator(opts),
    () => true
  );

  return (
    <ClientLayoutPreferenceProvider>
      <NotebookStoreProvider
        {...(props.ports.notebookStore !== undefined
          ? { store: props.ports.notebookStore }
          : {})}
      >
        <div class="box" style={appShellSx}>
          <ProductSimulatorScreen
            state={session.state}
            kind={props.kind}
            instance={props.instance}
            panes={props.panes}
            onKindChange={props.onKindChange}
            onInstanceChange={props.onInstanceChange}
            onPanePatch={props.onPanePatch}
            onReload={session.reboot}
            onExit={props.onExit}
          />
        </div>
      </NotebookStoreProvider>
    </ClientLayoutPreferenceProvider>
  );
}
