import type {
  HtmlReportTest,
  ReportSnapshotBlob,
  ReportStepHit,
} from '@pkgs/sim';
import {
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  Show,
  untrack,
} from 'solid-js';
import { useReport } from '../app/report-context';
import { blobDataUrl, blobText } from '../lib/frames';
import { PHONE_H, PHONE_W, zoomScale } from '../lib/phone';
import {
  createSnapshotIframe,
  drawHit,
  type HitResult,
  paintSnapshot,
  snapshotDocument,
} from '../lib/snapshot-surface';

type PanelProps = {
  test: HtmlReportTest;
  blob: ReportSnapshotBlob | null;
  /** `blob` is this client's latest earlier snapshot (none this frame). */
  stale: boolean;
  nodeId: string;
  hit: ReportStepHit | null;
  zoom: string;
  active: boolean;
  focused: boolean;
  onFocus: () => void;
};

/** Fit-to-box scale from a ResizeObserver; one signal, applied via CSS. */
function useFitScale(
  wrap: () => HTMLElement | undefined,
  zoom: () => string
): () => number {
  const [box, setBox] = createSignal({ w: PHONE_W, h: PHONE_H });
  onMount(() => {
    const el = wrap();
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    if (typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    onCleanup(() => ro.disconnect());
  });
  return () => zoomScale(zoom(), box().w, box().h);
}

/** Swap PNG sources only once the next image is decoded (no blank flash). */
function paintPng(img: HTMLImageElement, url: string): void {
  if (img.getAttribute('src') === url) return;
  const next = new Image();
  next.src = url;
  const swap = () => {
    if (img.dataset['want'] === url) img.src = url;
  };
  img.dataset['want'] = url;
  next.decode().then(swap, swap);
}

/**
 * Paints `props.blob` into one persistent iframe (HTML) or img (PNG) and
 * draws the press overlay. Never remounts per frame.
 */
function useSnapshotPainter(
  props: PanelProps,
  host: () => HTMLDivElement | undefined,
  img: () => HTMLImageElement | undefined
) {
  const report = useReport();
  const iframe = createSnapshotIframe();
  const [hitState, setHitState] = createSignal<HitResult>('none');
  const [painted, setPainted] = createSignal<'html' | 'png' | null>(null);

  const paint = (blob: ReportSnapshotBlob, hit: ReportStepHit | null) => {
    if (blob.media === 'png') {
      const url = blobDataUrl(props.test, blob);
      const el = img();
      if (url && el) paintPng(el, url);
      setPainted('png');
      setHitState('none');
      return;
    }
    const html = blobText(props.test, blob);
    const doc = snapshotDocument(iframe, report.frameCss);
    if (html === null || !doc) return;
    setHitState(paintSnapshot(doc, { key: blob.file, html }, hit));
    setPainted('html');
    // Web fonts shift layout once they land; re-place the overlay then.
    if (hit && doc.fonts && doc.fonts.status !== 'loaded') {
      void doc.fonts.ready.then(() => {
        if (props.hit === hit) drawHit(doc, hit);
      });
    }
  };

  onMount(() => {
    host()?.appendChild(iframe);
    // A re-attached iframe gets a fresh document; repaint the current frame.
    const reload = () => {
      const blob = untrack(() => props.blob);
      const hit = untrack(() => props.hit);
      if (blob?.media === 'html') paint(blob, hit);
    };
    iframe.addEventListener('load', reload);
    onCleanup(() => iframe.removeEventListener('load', reload));
  });

  createEffect(() => {
    const blob = props.blob;
    const hit = props.hit;
    if (blob) untrack(() => paint(blob, hit));
    else setPainted(null);
  });

  return { hitState, painted };
}

export function PhonePanel(props: PanelProps) {
  let wrapEl: HTMLDivElement | undefined;
  let hostEl: HTMLDivElement | undefined;
  let imgEl: HTMLImageElement | undefined;
  const scale = useFitScale(
    () => wrapEl,
    () => props.zoom
  );
  const { hitState, painted } = useSnapshotPainter(
    props,
    () => hostEl,
    () => imgEl
  );

  const activate = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    props.onFocus();
  };

  return (
    <div
      class="sr-client"
      classList={{
        active: props.active,
        focused: props.focused,
        stale: props.stale,
      }}
      role="button"
      tabindex="0"
      aria-label={`Focus ${props.nodeId}`}
      aria-current={props.focused ? 'true' : undefined}
      onClick={() => props.onFocus()}
      onKeyDown={activate}
    >
      <div class="sr-client-label">
        <span class="sr-dot" classList={{ passed: props.active }} />
        <span class="actor">{props.nodeId}</span>
        <Show when={props.stale}>
          <span class="sr-chip-note">
            {props.blob ? 'unchanged this frame' : 'not started yet'}
          </span>
        </Show>
        <Show when={!props.stale && hitState() === 'missing'}>
          <span class="sr-chip-note warn">target not in snapshot</span>
        </Show>
      </div>
      <div class="sr-phone" ref={wrapEl}>
        <div
          class="frame"
          classList={{ blank: painted() === null }}
          style={{
            width: `${PHONE_W * scale()}px`,
            height: `${PHONE_H * scale()}px`,
          }}
        >
          <div
            class="sr-snap-host"
            ref={hostEl}
            classList={{ hidden: painted() !== 'html' }}
            style={{ transform: `scale(${scale()})` }}
          />
          <img
            ref={imgEl}
            class="shot"
            classList={{ hidden: painted() !== 'png' }}
            alt=""
          />
          <Show when={painted() === null}>
            <div class="sr-client-empty">No snapshot yet</div>
          </Show>
        </div>
      </div>
    </div>
  );
}
