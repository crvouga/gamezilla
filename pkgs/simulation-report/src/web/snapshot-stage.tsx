import { useEffect, useRef, useState } from 'react';

import { loadPreviewFontCss, SNAPSHOT_SHELL_CSS } from './preview-fonts';
import {
  isBlankSnapshotBody,
  patchPreviewHtml,
  snapshotBodyHtml,
} from './preview-html';
import { reportFetch } from './wall';

const htmlCache = new Map<string, string>();

async function loadFrameHtml(url: string): Promise<string | null> {
  const cached = htmlCache.get(url);
  if (cached !== undefined) return cached;
  const res = await reportFetch(url);
  if (!res.ok) return null;
  const html = await res.text();
  htmlCache.set(url, html);
  return html;
}

/**
 * Double-buffered iframe srcdoc stage. Never assigns srcdoc on the visible
 * iframe; blank / identical bodies hold the last good front frame.
 */
export function SnapshotStage(props: { readonly src: string | null }) {
  const { src } = props;
  const frame0Ref = useRef<HTMLIFrameElement>(null);
  const frame1Ref = useRef<HTMLIFrameElement>(null);
  const frontRef = useRef<0 | 1>(0);
  const paintedSrcRef = useRef<string | null>(null);
  const paintedBodyRef = useRef<string | null>(null);
  const hasPaintedRef = useRef(false);
  const genRef = useRef(0);
  const [front, setFront] = useState<0 | 1>(0);
  const [hasPainted, setHasPainted] = useState(false);

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
  }, [src]);

  const cls = (idx: 0 | 1) =>
    `snapshot-frame${front === idx ? ' is-front' : ' is-back'}`;

  return (
    <div className="snapshot-stage">
      <iframe
        ref={frame0Ref}
        className={cls(0)}
        title="Snapshot A"
        sandbox="allow-same-origin"
      />
      <iframe
        ref={frame1Ref}
        className={cls(1)}
        title="Snapshot B"
        sandbox="allow-same-origin"
      />
      {!hasPainted ? (
        <div className="empty preview-empty">No snapshot</div>
      ) : null}
    </div>
  );
}
