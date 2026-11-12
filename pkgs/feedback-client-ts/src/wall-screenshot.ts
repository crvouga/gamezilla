// @io-wall-ok — browser screenshot adapter

import type { ScreenshotFile } from '@pkgs/feedback-shared-ts/types';
import type { ScreenshotPort } from './ports';

/** Wide enough to read, small enough to send over a poor connection. */
const MAX_WIDTH = 1280;
const QUALITY = 0.8;

const library = () => import('modern-screenshot');

async function capture(document: Document): Promise<ScreenshotFile | null> {
  const { domToBlob } = await library();
  const view = document.defaultView;
  if (!view) return null;
  const width = view.innerWidth;
  const height = view.innerHeight;
  const blob = await domToBlob(document.documentElement, {
    type: 'image/jpeg',
    quality: QUALITY,
    width,
    height,
    scale: Math.min(view.devicePixelRatio || 1, MAX_WIDTH / width),
    backgroundColor: view.getComputedStyle(document.body).backgroundColor,
    // What the person was looking at, not the top of the page.
    style: {
      transform: `translate(${-view.scrollX}px, ${-view.scrollY}px)`,
    },
    // Left out: the bug report, what an app marks private, and the words a
    // page keeps for a browser without scripts, which a clone would show.
    filter: (node) =>
      !(node instanceof view.Element) ||
      !node.matches('[data-feedback-root], [data-feedback-private], noscript'),
  });
  return {
    contentType: 'image/jpeg',
    bytes: new Uint8Array(await blob.arrayBuffer()),
  };
}

/**
 * Draws what the app is showing into a picture, without asking the person
 * for anything. Parts an app marks private are left out. A device that
 * cannot draw it yields no screenshot, never an error.
 */
export function browserScreenshotPort(document: Document): ScreenshotPort & {
  /** Fetches the drawing code ahead of need, so a later failure of the app cannot keep it away. */
  prepare(): void;
} {
  return {
    capture: () => capture(document).catch(() => null),
    prepare: () => void library().catch(() => undefined),
  };
}
