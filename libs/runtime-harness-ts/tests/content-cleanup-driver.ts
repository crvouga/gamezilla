import type {
  Driver,
  DriverNode,
} from '@pkgs/ui-testing-root-shared-ts/driver';

/** An owner's open library: reopening the page would discard this location. */
export function cleanupDriver() {
  let screen = 'library';
  let withdrawn = false;
  const unused = (): never => {
    throw new Error('Unexpected cleanup operation');
  };
  const shown = (id: string): boolean =>
    (screen === 'library' &&
      ['content-create-puzzle', 'content-draft-river-document'].includes(id)) ||
    (screen === 'author' && id === 'content-withdraw') ||
    (screen === 'confirm' && id === 'content-withdraw-confirm') ||
    (screen === 'success' && id === 'content-withdraw-dismiss');
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
      wait: async () => requireVisible(id),
      isVisible: async () => shown(id),
      text: unused,
      tap: async () => {
        requireVisible(id);
        if (id === 'content-withdraw') screen = 'confirm';
        else if (id === 'content-withdraw-confirm') screen = 'success';
        else {
          if (id === 'content-withdraw-dismiss') withdrawn = true;
          screen = 'author';
        }
      },
      expect: {
        visible: async () => requireVisible(id),
        hidden: unused,
        text: unused,
      },
    }),
  };
  return { ui, withdrawn: () => withdrawn };
}
