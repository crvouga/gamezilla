import type { HarnessConsolePorts } from '@pkgs/harness-console-shared-ts/ports';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import type { JSX } from 'solid-js';
import type { HarnessConsoleNav } from './debugger-chrome';
import { NotebookStoreProvider } from './notebook-store-context';
import { ProductHarnessScreen } from './product-harness-screen';
import { useProductHarnessSession } from './use-product-harness-session';

/**
 * Harness screen root — a flat sibling of the product app: harness controls
 * over a window manager with one panel per node of the running system.
 * `onExit` leaves for the app (also the "Exit harness" palette command and
 * toolbar button).
 *
 * `nav` (window layout and each node's view) is controlled by the host so
 * it can sync to browser history. Test reports live in the standalone Atlas
 * explorer, not a screen here.
 */
export function HarnessConsoleApp(props: {
  readonly ports: HarnessConsolePorts;
  readonly nav: HarnessConsoleNav;
  readonly onExit: () => void;
}): JSX.Element {
  const session = useProductHarnessSession(
    (opts) => props.ports.bootProductHarness(opts),
    () => true
  );

  return (
    <NotebookStoreProvider
      {...(props.ports.notebookStore !== undefined
        ? { store: props.ports.notebookStore }
        : {})}
    >
      <Surface tone="background" grow>
        <ProductHarnessScreen
          state={session.state}
          nav={props.nav}
          onReload={session.reboot}
          onExit={props.onExit}
        />
      </Surface>
    </NotebookStoreProvider>
  );
}
