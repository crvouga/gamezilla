import {
  HARNESS_APP_VIEW,
  type HarnessPanelRef,
  type HarnessSwitch,
  harnessApps,
  harnessPanels,
  harnessSwitchTarget,
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
  /** The id of what is on show: a panel's, or one of the extra views'. */
  readonly shownId: Accessor<string | null>;
  /** The panel on show, when what is on show is a node's panel. */
  readonly shown: Accessor<HarnessPanelRef | null>;
  readonly show: (panel: string) => void;
  /** The apps the switcher goes through, in its order. */
  readonly apps: Accessor<readonly string[]>;
  /** Where a press of the switcher goes; `null` when it is nowhere else. */
  readonly next: Accessor<string | null>;
  /**
   * Switch apps: on to the next or back to the one before (the views in the
   * switcher, then the harness's own app, around again), or straight to one.
   */
  readonly switchTo: (asked: HarnessSwitch) => void;
  /** Put a view in the switcher, or take it out. */
  readonly setInSwitcher: (view: string, on: boolean) => void;
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
 * What the console shows: a panel per node of the session and the harness's
 * own app, one of them at a time. Which one lives with the host as text
 * (`nav().show`), so a link reopens it; a choice that is gone falls back to
 * the first client, and to the harness app in a world with none. `nav` is an accessor because the host hands over a fresh
 * value on every change.
 */
export function useHarnessView(
  session: Accessor<HarnessViewSession>,
  nav: Accessor<HarnessConsoleNav>,
  /** Ids of views that are not a node's panel (an emulator's dashboard). */
  extra: Accessor<readonly string[]> = () => []
): HarnessView {
  const revision = useSessionRevision(session);
  const panels = useHarnessPanels(session, revision);
  const ids = createMemo(() => [
    ...panels().map((panel) => panel.id),
    ...extra(),
    HARNESS_APP_VIEW,
  ]);
  const shownId = createMemo(() => resolveHarnessView(nav().show, ids()));
  const show = (panel: string): void => {
    if (panel !== untrack(shownId)) untrack(nav).onShow(panel, 'push');
  };
  const apps = createMemo(() => harnessApps(ids(), nav().switcher));
  const next = createMemo(() => {
    const to = harnessSwitchTarget(
      { to: 'next' },
      shownId(),
      ids(),
      nav().switcher
    );
    return to === shownId() ? null : to;
  });
  return {
    revision,
    panels,
    shownId,
    shown: createMemo(
      () => panels().find((panel) => panel.id === shownId()) ?? null
    ),
    show,
    apps,
    next,
    switchTo: (asked) => {
      const to = harnessSwitchTarget(
        asked,
        untrack(shownId),
        untrack(ids),
        untrack(nav).switcher
      );
      if (to !== null) show(to);
    },
    setInSwitcher: (view, on) => untrack(nav).onSwitcher(view, on),
  };
}
