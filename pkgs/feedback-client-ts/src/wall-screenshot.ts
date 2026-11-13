// @io-wall-ok — browser screenshot adapter

import type { ScreenBox, ScreenshotFile } from '@pkgs/feedback-shared-ts/types';
import type { ScreenshotOptions, ScreenshotPort } from './ports';

/** Wide enough to read, small enough to send over a poor connection. */
const MAX_WIDTH = 1280;
const QUALITY = 0.8;

const library = () => import('modern-screenshot');

/** How thick the mark around the thing a bug report is about is, in CSS px. */
const MARK_PX = 3;

/** Draws a box around `highlight`, in the colour the app gives to what is wrong. */
function mark(
  canvas: HTMLCanvasElement,
  view: Window,
  width: number,
  highlight: ScreenBox
): void {
  const context = canvas.getContext('2d');
  if (!context) return;
  const scale = canvas.width / width;
  const root = view.getComputedStyle(view.document.documentElement);
  context.strokeStyle =
    root.getPropertyValue('--color-destructive').trim() ||
    view.getComputedStyle(view.document.body).color;
  context.lineWidth = MARK_PX * scale;
  const inset = (MARK_PX / 2) * scale;
  context.strokeRect(
    highlight.x * scale - inset,
    highlight.y * scale - inset,
    highlight.width * scale + inset * 2,
    highlight.height * scale + inset * 2
  );
}

async function capture(
  document: Document,
  options: ScreenshotOptions | undefined
): Promise<ScreenshotFile | null> {
  const { domToCanvas } = await library();
  const view = document.defaultView;
  if (!view) return null;
  const width = view.innerWidth;
  const height = view.innerHeight;
  const canvas = await domToCanvas(document.documentElement, {
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
  if (options?.highlight) mark(canvas, view, width, options.highlight);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', QUALITY)
  );
  if (!blob) return null;
  return {
    contentType: 'image/jpeg',
    bytes: new Uint8Array(await blob.arrayBuffer()),
  };
}

/**
 * Draws what the app is showing into a picture, without asking the person
 * for anything, with the thing a bug report is about marked. Parts an app
 * marks private are left out. A device that
 * cannot draw it yields no screenshot, never an error.
 */
export function browserScreenshotPort(document: Document): ScreenshotPort & {
  /** Fetches the drawing code ahead of need, so a later failure of the app cannot keep it away. */
  prepare(): void;
} {
  return {
    capture: (options) => capture(document, options).catch(() => null),
    prepare: () => void library().catch(() => undefined),
  };
}
