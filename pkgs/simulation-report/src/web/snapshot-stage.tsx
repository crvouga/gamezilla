import { type RefObject, useEffect, useRef, useState } from 'react';

import type { SimulationStep } from '../types';
import {
  applyInteractionOverlay,
  clearInteractionOverlay,
} from './interaction-overlay';
import { loadPreviewFontCss, SNAPSHOT_SHELL_CSS } from './preview-fonts';
import {
  isBlankSnapshotBody,
  patchPreviewHtml,
  snapshotBodyHtml,
} from './preview-html';
import { merge, styles } from './theme';
import { reportFetch } from './wall';

const htmlCache = new Map<string, string>();

/** Peek cached raw frame HTML (pre-patch) for Copy prompt. */
export function peekFrameHtmlCache(url: string): string | undefined {
  return htmlCache.get(url);
}

async function loadFrameHtml(url: string): Promise<string | null> {
  const cached = htmlCache.get(url);
  if (cached !== undefined) return cached;
  const res = await reportFetch(url);
  if (!res.ok) return null;
  const html = await res.text();
  htmlCache.set(url, html);
  return html;
}

type PaintRefs = {
  readonly frame0Ref: RefObject<HTMLIFrameElement | null>;
  readonly frame1Ref: RefObject<HTMLIFrameElement | null>;
  readonly frontRef: RefObject<0 | 1>;
  readonly paintedSrcRef: RefObject<string | null>;
  readonly paintedBodyRef: RefObject<string | null>;
  readonly hasPaintedRef: RefObject<boolean>;
  readonly genRef: RefObject<number>;
};

type InteractionStep = Pick<SimulationStep, 'kind' | 'selector' | 'detail'>;

function applyOverlayToFrame(
  frame: HTMLIFrameElement | null,
  step: InteractionStep | null
): void {
  const doc = frame?.contentDocument;
  if (!doc) return;
  if (step) applyInteractionOverlay(doc, step);
  else clearInteractionOverlay(doc);
}

function useSnapshotPaint(
  src: string | null,
  refs: PaintRefs,
  setFront: (front: 0 | 1) => void,
  setHasPainted: (painted: boolean) => void
): void {
  const {
    frame0Ref,
    frame1Ref,
    frontRef,
    paintedSrcRef,
    paintedBodyRef,
    hasPaintedRef,
    genRef,
  } = refs;

  useEffect(() => {
    if (src === null) {
      genRef.current += 1;
      return;
    }
    if (src === paintedSrcRef.current) return;

    const gen = ++genRef.current;
    let cancelled = false;
    let pendingBody = '';
    const back: 0 | 1 = frontRef.current === 0 ? 1 : 0;
    const backFrame = back === 0 ? frame0Ref.current : frame1Ref.current;
    if (backFrame === null) return;

    const onLoad = () => {
      if (cancelled || gen !== genRef.current) return;
      frontRef.current = back;
      paintedSrcRef.current = src;
      paintedBodyRef.current = pendingBody;
      hasPaintedRef.current = true;
      setFront(back);
      setHasPainted(true);
    };
    void (async () => {
      const [html, fontCss] = await Promise.all([
        loadFrameHtml(src),
        loadPreviewFontCss(),
      ]);
      if (cancelled || gen !== genRef.current) return;

      if (html === null) {
        paintedSrcRef.current = src;
        return;
      }

      const bodyHtml = snapshotBodyHtml(html);

      if (isBlankSnapshotBody(bodyHtml) && hasPaintedRef.current) {
        paintedSrcRef.current = src;
        return;
      }

      if (bodyHtml === paintedBodyRef.current) {
        paintedSrcRef.current = src;
        return;
      }

      const doc = patchPreviewHtml(html, {
        fontCss,
        shellCss: SNAPSHOT_SHELL_CSS,
      });
      pendingBody = bodyHtml;
      backFrame.addEventListener('load', onLoad, { once: true });
      backFrame.srcdoc = doc;
    })();

    return () => {
      cancelled = true;
      backFrame.removeEventListener('load', onLoad);
    };
  }, [
    src,
    frame0Ref,
    frame1Ref,
    frontRef,
    paintedSrcRef,
    paintedBodyRef,
    hasPaintedRef,
    genRef,
    setFront,
    setHasPainted,
  ]);
}

function useInteractionOverlay(args: {
  readonly front: 0 | 1;
  readonly hasPainted: boolean;
  readonly interactionStep: InteractionStep | null;
  readonly frame0Ref: RefObject<HTMLIFrameElement | null>;
  readonly frame1Ref: RefObject<HTMLIFrameElement | null>;
}): void {
  const { front, hasPainted, interactionStep, frame0Ref, frame1Ref } = args;
  useEffect(() => {
    if (!hasPainted) return;
    const frontFrame = front === 0 ? frame0Ref.current : frame1Ref.current;
    applyOverlayToFrame(frontFrame, interactionStep);
  }, [front, hasPainted, interactionStep, frame0Ref, frame1Ref]);
}

/**
 * Double-buffered iframe srcdoc stage. Never assigns srcdoc on the visible
 * iframe; blank / identical bodies hold the last good front frame.
 */
export function SnapshotStage(props: {
  readonly src: string | null;
  readonly interactionStep?: InteractionStep | null;
}) {
  const { src, interactionStep = null } = props;
  const frame0Ref = useRef<HTMLIFrameElement>(null);
  const frame1Ref = useRef<HTMLIFrameElement>(null);
  const frontRef = useRef<0 | 1>(0);
  const paintedSrcRef = useRef<string | null>(null);
  const paintedBodyRef = useRef<string | null>(null);
  const hasPaintedRef = useRef(false);
  const genRef = useRef(0);
  const [front, setFront] = useState<0 | 1>(0);
  const [hasPainted, setHasPainted] = useState(false);

  useSnapshotPaint(
    src,
    {
      frame0Ref,
      frame1Ref,
      frontRef,
      paintedSrcRef,
      paintedBodyRef,
      hasPaintedRef,
      genRef,
    },
    setFront,
    setHasPainted
  );
  useInteractionOverlay({
    front,
    hasPainted,
    interactionStep,
    frame0Ref,
    frame1Ref,
  });

  const frameStyle = (idx: 0 | 1) =>
    merge(
      styles.snapshotFrame,
      front === idx ? styles.snapshotFront : styles.snapshotBack
    );

  return (
    <div style={styles.snapshotStage}>
      <iframe
        ref={frame0Ref}
        style={frameStyle(0)}
        title="Snapshot A"
        sandbox=""
      />
      <iframe
        ref={frame1Ref}
        style={frameStyle(1)}
        title="Snapshot B"
        sandbox=""
      />
      {!hasPainted ? <div style={styles.previewEmpty}>No snapshot</div> : null}
    </div>
  );
}
