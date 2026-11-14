import type {
  Driver,
  DriverNode,
} from '@pkgs/ui-testing-root-shared-ts/driver';

/** What each small screen of the owner's library and builder shows. */
const SCREENS: Readonly<Record<string, readonly string[]>> = {
  library: [
    'content-library',
    'content-library-tab-continue',
    'content-library-tab-mine',
    'content-create-puzzle',
  ],
  mine: [
    'content-library',
    'content-library-mine',
    'content-draft-river-document',
  ],
  builder: ['content-author', 'content-author-steps', 'content-open-publish'],
  publish: [
    'content-author',
    'content-author-publish',
    'content-publication-status',
    'content-withdraw',
  ],
  confirm: ['content-author', 'content-withdraw-confirm'],
  success: ['content-author', 'content-withdraw-dismiss'],
};

/** Where each press leads, by the screen it is pressed on. */
const LEADS: Readonly<Record<string, string>> = {
  'library:content-library-tab-mine': 'mine',
  'mine:content-draft-river-document': 'builder',
  'mine:nav-back': 'library',
  'builder:content-open-publish': 'publish',
  'builder:nav-back': 'library',
  'publish:content-withdraw': 'confirm',
  'publish:nav-back': 'builder',
  'confirm:content-withdraw-confirm': 'success',
  'success:content-withdraw-dismiss': 'publish',
};

/** An owner's open library: reopening the page would discard this location. */
export function cleanupDriver() {
  let screen = 'library';
  let withdrawn = false;
  const visited: string[] = [];
  const unused = (): never => {
    throw new Error('Unexpected cleanup operation');
  };
  const shown = (id: string): boolean =>
    id === 'nav-back' || (SCREENS[screen] ?? []).includes(id);
  const requireVisible = (id: string): void => {
    if (!shown(id)) throw new Error(`${id} unavailable on ${screen}`);
  };
  const ui: Driver = {
    kind: 'script',
    launch: unused,
    close: unused,
    key: unused,
    snapshotHtml: unused,
    get: (id): DriverNode => ({
      get: unused,
      attribute: unused,
      tapAt: unused,
      drag: unused,
      layout: unused,
      selectFile: unused,
      input: unused,
      clear: unused,
      key: unused,
      scroll: unused,
      wait: async (_state, options) => {
        if (options?.visibleOr?.some(shown)) return;
        requireVisible(id);
      },
      isVisible: async () => shown(id),
      text: unused,
      tap: async () => {
        requireVisible(id);
        const next = LEADS[`${screen}:${id}`];
        if (next === undefined)
          throw new Error(`${id} leads nowhere from ${screen}`);
        if (id === 'content-withdraw-dismiss') withdrawn = true;
        screen = next;
        visited.push(next);
      },
      expect: {
        visible: async () => requireVisible(id),
        hidden: unused,
        // The publish screen has settled on the published edition.
        text: async () => requireVisible(id),
      },
    }),
  };
  return { ui, withdrawn: () => withdrawn, visited: () => visited };
}
