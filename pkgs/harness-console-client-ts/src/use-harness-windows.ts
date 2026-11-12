import type { Timers } from '@pkgs/clock-shared-ts/types';
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
  batch,
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

/** The part of a session the windows are derived from. */
export type HarnessWindowsSession = Pick<
  ProductHarnessSession,
  'revision' | 'subscribe' | 'snapshotRestoring'
> & {
  readonly clients: ReadonlyMap<string, unknown>;
  readonly servers: ReadonlyMap<string, unknown>;
  readonly rooms: ReadonlyMap<string, unknown>;
};

function samePanels(
  a: readonly HarnessPanelRef[],
  b: readonly HarnessPanelRef[]
): boolean {
  return a.length === b.length && a.every((ref, at) => ref.id === b[at]?.id);
}

function useSessionRevision(
  session: Accessor<HarnessWindowsSession>
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
  session: Accessor<HarnessWindowsSession>,
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

/** How long a resize or a focus change waits before it reaches the host. */
export const HARNESS_LAYOUT_SETTLE_MS = 200;

type HeldLayout = {
  /** The host's text this layout stands in for. */
  readonly host: string | null;
  readonly layout: WindowLayout;
};

/**
 * The layout as last changed here over the host's text. Windows keep their
 * ids while the host echoes a change back; any other text (history, a pasted
 * address) is read afresh. A passing change -- one of the many a divider
 * drag makes -- shows at once and reaches the host when the gesture settles,
 * so the host is not written to on every pointer move.
 */
function useHeldLayout(args: {
  readonly nav: Accessor<HarnessConsoleNav>;
  readonly ids: Accessor<readonly string[]>;
  readonly timers: Timers;
}) {
  const { nav, ids, timers } = args;
  const hostText = createMemo(() => nav().layout);
  const [held, setHeld] = createSignal<HeldLayout | null>(null);
  let pending: unknown = null;
  const layout = createMemo(() => {
    const own = held();
    return own !== null && own.host === hostText()
      ? pruneWindowLayout(own.layout, ids())
      : resolveHarnessLayout(hostText(), ids());
  });
  const drop = (): void => {
    if (pending !== null) timers.clearTimeout(pending);
    pending = null;
  };
  const write = (next: WindowLayout, mode: 'push' | 'replace'): void => {
    drop();
    const text = serializeWindowLayout(next);
    batch(() => {
      setHeld({ host: text, layout: next });
      untrack(nav).onLayoutChange(text, mode);
    });
  };
  const settle = (next: WindowLayout): void => {
    drop();
    setHeld({ host: untrack(hostText), layout: next });
    pending = timers.setTimeout(
      () => write(next, 'replace'),
      HARNESS_LAYOUT_SETTLE_MS
    );
  };
  // A layout from the host itself (history, a pasted address) is not
  // written over by a change that was still settling.
  createEffect(
    on(hostText, (text) => {
      if (untrack(held)?.host !== text) drop();
    })
  );
  onCleanup(drop);
  return {
    layout,
    write,
    settle,
    reset: (): void => {
      drop();
      batch(() => {
        setHeld(null);
        untrack(nav).onLayoutChange(null, 'push');
      });
    },
  };
}

/**
 * The console's windows: a panel per node of the session and the layout that
 * arranges them. The layout lives with the host as text (`nav().layout`); a
 * node that appears later is given a panel, one that goes loses its panel.
 * `nav` is an accessor because the host hands over a fresh value on every
 * change: a value read once would never show the change.
 */
export function useHarnessWindows(
  session: Accessor<HarnessWindowsSession>,
  nav: Accessor<HarnessConsoleNav>,
  timers: Timers
): HarnessWindows {
  const revision = useSessionRevision(session);
  const panels = useHarnessPanels(session, revision);
  const ids = createMemo(() => panels().map((panel) => panel.id));
  const held = useHeldLayout({ nav, ids, timers });
  const layout = held.layout;
  let seen = new Set(untrack(ids));
  createEffect(
    on(
      ids,
      (now) => {
        const fresh = now.filter((id) => !seen.has(id));
        seen = new Set(now);
        // The starting arrangement already places every node.
        if (fresh.length === 0 || untrack(nav).layout === null) return;
        held.write(admitHarnessPanels(untrack(layout), fresh), 'replace');
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
      if (command.type === 'resize' || command.type === 'focus')
        held.settle(next);
      else held.write(next, 'push');
    },
    arrange: (arrangement) => {
      held.write(arrangeHarnessLayout(ids(), arrangement, layout()), 'push');
    },
    reset: held.reset,
  };
}
