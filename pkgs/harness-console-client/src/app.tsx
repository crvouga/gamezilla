import type { HarnessChromeKind } from '@pkgs/harness-console-shared/node';
import type { HarnessConsolePorts } from '@pkgs/harness-console-shared/ports';
import type { JSX } from 'solid-js';
import { ClientLayoutPreferenceProvider } from './client-layout-preference';
import type { PaneNavPatch, PaneNavValue } from './debugger-chrome';
import { NotebookStoreProvider } from './notebook-store-context';
import { ProductHarnessScreen } from './product-harness-screen';
import { appShellSx } from './tokens';
import { useProductHarnessSession } from './use-product-harness-session';

/**
 * Harness screen root — a flat sibling of the product app, no chrome of
 * its own beyond the debugger. `onExit` leaves for the app (also exposed as
 * the "Exit harness" palette command and toolbar button).
 *
 * Harness nav is controlled by the host so it can sync to browser history.
 * Test reports live in the standalone Atlas explorer, not a
 * screen here.
 */
export function HarnessConsoleApp(props: {
  readonly ports: HarnessConsolePorts;
  readonly kind: HarnessChromeKind;
  readonly instance: string;
  readonly panes: Readonly<Record<string, PaneNavValue>>;
  readonly onKindChange: (kind: HarnessChromeKind) => void;
  readonly onInstanceChange: (instance: string) => void;
  readonly onPanePatch: (
    id: string,
    patch: PaneNavPatch,
    mode?: 'push' | 'replace'
  ) => void;
  readonly onExit: () => void;
}): JSX.Element {
  const session = useProductHarnessSession(
    (opts) => props.ports.bootProductHarness(opts),
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
          <ProductHarnessScreen
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
