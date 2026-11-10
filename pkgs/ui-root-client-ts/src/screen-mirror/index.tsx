/** @jsxImportSource solid-js */

import {
  type ComponentDataSet,
  dataAttrs,
} from '@pkgs/ui-root-shared-ts/component-id';
import {
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  onMount,
} from 'solid-js';

/** The screen sizes a mirror draws the other screen at. */
export type ScreenMirrorDevice = 'phone' | 'desktop';

export type ScreenMirrorProps = {
  /** Accessible name: whose screen this is. */
  title: string;
  /**
   * The other screen's body markup, already sanitized: no scripts, no
   * values a person typed. It is drawn with this app's own stylesheets and
   * nothing in it can run.
   */
  html: string;
  /** The size the other screen is drawn at before it is scaled to fit. */
  device?: ScreenMirrorDevice | undefined;
  /** DOM `data-*` identifiers; `testid` names the mirrored document. */
  dataSet?: ComponentDataSet | undefined;
};

/** The hairline around the picture (`border`), on each side. */
const BORDER_PX = 1;

const DEVICE_SIZE: Record<ScreenMirrorDevice, { w: number; h: number }> = {
  phone: { w: 390, h: 844 },
  desktop: { w: 1280, h: 800 },
};

/** This app's stylesheets, so the mirrored screen looks as it does there. */
function hostStyles(): string {
  if (typeof document === 'undefined') return '';
  return [...document.querySelectorAll('link[rel="stylesheet"], style')]
    .map((node) => node.outerHTML)
    .join('');
}

/** A complete document for the frame; inert, unclickable, unscrollable. */
function mirroredDocument(styles: string, html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">${styles}<style>html,body{margin:0;pointer-events:none;overflow:hidden}</style></head>${html}</html>`;
}

/**
 * `ScreenMirror` -- another person's screen, drawn as they see it and scaled
 * to fit the room it is given, never wider than the device it mirrors. The picture is a sandboxed document with no
 * scripts, forms or navigation: it can be looked at, never used. Its
 * markup must already be sanitized; the mirror adds only this app's styles.
 *
 * @example
 * ```tsx
 * <ScreenMirror title={t`Bob's screen`} html={frame.html} />
 * ```
 */
export function ScreenMirror(props: ScreenMirrorProps): JSX.Element {
  const [styles, setStyles] = createSignal('');
  const [width, setWidth] = createSignal<number | null>(null);
  let host: HTMLDivElement | undefined;
  const size = () => DEVICE_SIZE[props.device ?? 'phone'];
  const scale = createMemo(() => {
    const room = width();
    return room === null || room <= 0 ? 1 : Math.min(1, room / size().w);
  });
  onMount(() => {
    setStyles(hostStyles());
    if (host === undefined || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0]?.contentRect.width ?? null);
    });
    observer.observe(host);
    onCleanup(() => observer.disconnect());
  });
  return (
    <div
      ref={host}
      class="box w-full overflow-hidden rounded-card border border-border bg-surface"
      // Never wider than the screen it draws, so a wide column shows the
      // device's own shape instead of the picture beside an empty band.
      style={{
        'max-width': `${size().w + BORDER_PX * 2}px`,
        height: `${Math.round(size().h * scale())}px`,
      }}
      {...dataAttrs({ component: 'ScreenMirror' })}
    >
      <iframe
        class="box border-0"
        title={props.title}
        // Same origin only so its stylesheets load and the browser can read its
        // navigator; without allow-scripts nothing in it can ever run.
        sandbox="allow-same-origin"
        srcdoc={mirroredDocument(styles(), props.html)}
        style={{
          width: `${size().w}px`,
          height: `${size().h}px`,
          transform: `scale(${scale()})`,
          'transform-origin': 'top left',
        }}
        {...dataAttrs(props.dataSet)}
      />
    </div>
  );
}
