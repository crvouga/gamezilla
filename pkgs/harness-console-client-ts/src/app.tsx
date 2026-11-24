import type { HarnessConsolePorts } from '@pkgs/harness-console-shared-ts/ports';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import type { JSX } from '@solidjs/web';
import type { Component } from 'solid-js';
import type { HarnessConsoleNav } from './debugger-chrome';
import { NotebookStoreProvider } from './notebook-store-context';
import {
  type PreviewShellProps,
  ProductHarnessScreen,
} from './product-harness-screen';
import { useProductHarnessSession } from './use-product-harness-session';

/**
 * Harness screen root: harness controls over a window manager with one
 * panel per node of the running system.
 *
 * `nav` (window layout and each node's view) is controlled by the host so
 * it can sync to browser history.
 */
export function HarnessConsoleApp(props: {
  readonly shell: Component<PreviewShellProps>;
  readonly ports: HarnessConsolePorts;
  readonly nav: HarnessConsoleNav;
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
          shell={props.shell}
          state={session.state}
          nav={props.nav}
          onReload={session.reboot}
        />
      </Surface>
    </NotebookStoreProvider>
  );
}
