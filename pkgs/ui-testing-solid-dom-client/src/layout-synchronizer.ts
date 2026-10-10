import { MULTI_APP_ACTOR_FRAME } from '@pkgs/ui-testing-solid-dom-shared/snapshot-frame';
import { layoutDomTree } from './dom-tree-layout';

/** A layout-less host performs layout on observation, as a browser does. */
export function createLayoutSynchronizer(container: () => HTMLElement | null) {
  let watched: HTMLElement | null = null;
  let dirty = true;
  const observer = new MutationObserver(() => {
    dirty = true;
  });
  return {
    sync() {
      const root = container();
      if (root === null) return;
      if (root !== watched) {
        observer.disconnect();
        watched = root;
        dirty = true;
        observer.observe(root, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['class', 'style', 'hidden'],
        });
      }
      if (!dirty) return;
      dirty = false;
      layoutDomTree(root, MULTI_APP_ACTOR_FRAME);
    },
    close() {
      observer.disconnect();
      watched = null;
    },
  };
}
