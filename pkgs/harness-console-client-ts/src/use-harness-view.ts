import {
  type HarnessPanelRef,
  harnessPanels,
  nextHarnessClient,
  resolveHarnessView,
} from '@pkgs/harness-console-shared-ts/harness-windows';
import type { ProductHarnessSession } from '@pkgs/harness-console-shared-ts/ports';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  untrack,
} from 'solid-js';
import type { HarnessConsoleNav } from './debugger-chrome';

export type HarnessView = {
  /** Bumps whenever the session's nodes change; session maps mutate in place. */
  readonly revision: Accessor<number>;
  /** One panel per node, in a stable order. */
  readonly panels: Accessor<readonly HarnessPanelRef[]>;
  /** The one panel on show. */
  readonly shown: Accessor<HarnessPanelRef | null>;
  readonly show: (panel: string) => void;
  /** On to the next client's app, around to the first again. */
  readonly next: () => void;
};

/** The part of a session the panels are derived from. */
export type HarnessViewSession = Pick<
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
  session: Accessor<HarnessViewSession>
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
  session: Accessor<HarnessViewSession>,
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
 * What the console shows: a panel per node of the session, one of them at a
 * time. Which one lives with the host as text (`nav().show`), so a link
 * reopens it; a choice that is gone falls back to the first client. `nav` is
 * an accessor because the host hands over a fresh value on every change.
 */
export function useHarnessView(
  session: Accessor<HarnessViewSession>,
  nav: Accessor<HarnessConsoleNav>
): HarnessView {
  const revision = useSessionRevision(session);
  const panels = useHarnessPanels(session, revision);
  const ids = createMemo(() => panels().map((panel) => panel.id));
  const shownId = createMemo(() => resolveHarnessView(nav().show, ids()));
  const show = (panel: string): void => {
    if (panel !== untrack(shownId)) untrack(nav).onShow(panel, 'push');
  };
  return {
    revision,
    panels,
    shown: createMemo(
      () => panels().find((panel) => panel.id === shownId()) ?? null
    ),
    show,
    next: () => {
      const next = nextHarnessClient(untrack(shownId), untrack(ids));
      if (next !== null) show(next);
    },
  };
}
