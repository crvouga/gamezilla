/** @jsxImportSource solid-js */
/**
 * `mountApplication` -- how an app entry point puts its root component on
 * the page. It loads the design-system stylesheet and fonts, finds the mount element,
 * clears the boot markup inside it and renders.
 *
 * An entry point calls this instead of importing `render` from the
 * platform, reading `document`, or importing a stylesheet:
 *
 * ```tsx
 * const client = createClient(env, options);
 * mountApplication(() => <client.App />, {
 *   onPageHide: () => void client.close(),
 * });
 * ```
 *
 * Rendering into a part of the tree from inside the app is `OverlayPortal`;
 * rendering a component held in a value is `Icon` (for icons) or a JSX tag.
 */

import '../fonts';
import '../application.css';
import type { JSX } from 'solid-js';
import { render } from 'solid-js/web';

export type MountOptions = {
  /** `id` of the mount element in the host page. Default `root`. */
  readonly rootId?: string | undefined;
  /**
   * The page is being hidden for good or frozen (tab closed, app
   * backgrounded): release what must not outlive it.
   */
  readonly onPageHide?: (() => void) | undefined;
};

const DEFAULT_ROOT_ID = 'root';

/**
 * Render `root` into the mount element. Returns the unmount function, which
 * also stops listening for the page hiding.
 */
export function mountApplication(
  root: () => JSX.Element,
  options: MountOptions = {}
): () => void {
  const rootId = options.rootId ?? DEFAULT_ROOT_ID;
  const host = document.getElementById(rootId);
  if (host === null) {
    throw new Error(`mountApplication: no #${rootId} element on the page`);
  }
  host.replaceChildren();
  const dispose = render(root, host);
  const onPageHide = options.onPageHide;
  if (onPageHide === undefined) return dispose;
  window.addEventListener('pagehide', onPageHide);
  return () => {
    window.removeEventListener('pagehide', onPageHide);
    dispose();
  };
}
