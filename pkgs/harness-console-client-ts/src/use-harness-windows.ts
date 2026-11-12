import {
  admitHarnessPanels,
  arrangeHarnessLayout,
  type HarnessArrangement,
  type HarnessPanelRef,
  harnessPanels,
  resolveHarnessLayout,
} from '@pkgs/harness-console-shared-ts/harness-windows';
import type { ProductHarnessSession } from '@pkgs/harness-console-shared-ts/ports';
import {
  pruneWindowLayout,
  type WindowLayout,
  type WindowLayoutCommand,
  windowById,
} from '@pkgs/ui-devtools-shared-ts/window-layout';
import { serializeWindowLayout } from '@pkgs/ui-devtools-shared-ts/window-layout-codec';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  untrack,
} from 'solid-js';
import type { HarnessConsoleNav } from './debugger-chrome';

export type HarnessWindows = {
  /** Bumps whenever the session's nodes change; session maps mutate in place. */
  readonly revision: Accessor<number>;
  /** One panel per node, in a stable order. */
  readonly panels: Accessor<readonly HarnessPanelRef[]>;
  readonly layout: Accessor<WindowLayout>;
  /** The panel on show in the focused window. */
  readonly focusedPanel: Accessor<string | null>;
  readonly onLayoutChange: (
    layout: WindowLayout,
    command: WindowLayoutCommand
  ) => void;
  readonly arrange: (arrangement: HarnessArrangement) => void;
  /** Back to the starting arrangement. */
  readonly reset: () => void;
};

function samePanels(
  a: readonly HarnessPanelRef[],
  b: readonly HarnessPanelRef[]
): boolean {
  return a.length === b.length && a.every((ref, at) => ref.id === b[at]?.id);
}

function useSessionRevision(
  session: Accessor<ProductHarnessSession>
): Accessor<number> {
  const [revision, setRevision] = createSignal(untrack(session).revision);
  createEffect(() => {
    const current = session();
    setRevision(current.revision);
    onCleanup(current.subscribe(() => setRevision(current.revision)));
  });
  return revision;
}

function useHarnessPanels(
  session: Accessor<ProductHarnessSession>,
  revision: Accessor<number>
): Accessor<readonly HarnessPanelRef[]> {
  // A snapshot restore empties the client map for a moment; the client
  // panels keep their place and show nothing until the clients are back.
  const clients = createMemo<readonly string[]>((before) => {
    revision();
    return session().snapshotRestoring ? before : [...session().clients.keys()];
  }, []);
  return createMemo(
    () => {
      revision();
      return harnessPanels({
        clients: clients(),
        servers: [...session().servers.keys()],
        rooms: [...session().rooms.keys()],
      });
    },
    undefined,
    { equals: samePanels }
  );
}

/**
 * The console's windows: a panel per node of the session and the layout that
 * arranges them. The layout lives with the host as text (`nav.layout`); a
 * node that appears later is given a panel, one that goes loses its panel.
 */
export function useHarnessWindows(
  session: Accessor<ProductHarnessSession>,
  nav: HarnessConsoleNav
): HarnessWindows {
  const revision = useSessionRevision(session);
  const panels = useHarnessPanels(session, revision);
  const ids = createMemo(() => panels().map((panel) => panel.id));
  // The layout as last changed here, so windows keep their ids while the
  // host echoes the text back; any other text (history, a pasted address)
  // is read afresh.
  const [held, setHeld] = createSignal<{
    readonly text: string;
    readonly layout: WindowLayout;
  } | null>(null);
  const layout = createMemo(() => {
    const own = held();
    return own !== null && own.text === nav.layout
      ? pruneWindowLayout(own.layout, ids())
      : resolveHarnessLayout(nav.layout, ids());
  });
  const commit = (next: WindowLayout, mode: 'push' | 'replace'): void => {
    const text = serializeWindowLayout(next);
    setHeld({ text, layout: next });
    nav.onLayoutChange(text, mode);
  };
  let seen = new Set(untrack(ids));
  createEffect(
    on(
      ids,
      (now) => {
        const fresh = now.filter((id) => !seen.has(id));
        seen = new Set(now);
        // The starting arrangement already places every node.
        if (fresh.length === 0 || nav.layout === null) return;
        commit(admitHarnessPanels(untrack(layout), fresh), 'replace');
      },
      { defer: true }
    )
  );
  return {
    revision,
    panels,
    layout,
    focusedPanel: createMemo(
      () => windowById(layout(), layout().focused)?.active ?? null
    ),
    onLayoutChange: (next, command) => {
      const passing = command.type === 'resize' || command.type === 'focus';
      commit(next, passing ? 'replace' : 'push');
    },
    arrange: (arrangement) => {
      commit(arrangeHarnessLayout(ids(), arrangement, layout()), 'push');
    },
    reset: () => {
      setHeld(null);
      nav.onLayoutChange(null, 'push');
    },
  };
}
