import { useEffect, useRef, useState } from 'react';

import { loadPreviewFontCss, SNAPSHOT_SHELL_CSS } from './preview-fonts';
import { patchPreviewHtml } from './preview-html';
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
 * Double-buffered iframes: load the next frame into the hidden buffer, then
 * swap on `load` so the visible document is never blanked by `srcdoc` assign.
 */
export function PreviewFrame(props: { readonly src: string | null }) {
  const { src } = props;
  const iframe0Ref = useRef<HTMLIFrameElement>(null);
  const iframe1Ref = useRef<HTMLIFrameElement>(null);
  const frontRef = useRef<0 | 1>(0);
  const genRef = useRef(0);
  const [front, setFront] = useState<0 | 1>(0);
  const [empty, setEmpty] = useState(src === null);
  const [hasPainted, setHasPainted] = useState(false);

  useEffect(() => {
    if (src === null) {
      genRef.current += 1;
      setEmpty(true);
      return;
    }

    const gen = ++genRef.current;
    let cancelled = false;
    const back: 0 | 1 = frontRef.current === 0 ? 1 : 0;
    const backEl = back === 0 ? iframe0Ref.current : iframe1Ref.current;
    if (backEl === null) return;

    const onLoad = () => {
      if (cancelled || gen !== genRef.current) return;
      frontRef.current = back;
      setFront(back);
      setEmpty(false);
      setHasPainted(true);
    };

    void (async () => {
      const [html, fontCss] = await Promise.all([
        loadFrameHtml(src),
        loadPreviewFontCss(),
      ]);
      if (cancelled || gen !== genRef.current) return;
      if (html === null) {
        setEmpty(true);
        return;
      }
      const patched = patchPreviewHtml(html, {
        fontCss,
        shellCss: SNAPSHOT_SHELL_CSS,
      });
      backEl.addEventListener('load', onLoad, { once: true });
      backEl.srcdoc = patched;
    })();

    return () => {
      cancelled = true;
      backEl.removeEventListener('load', onLoad);
    };
  }, [src]);

  return (
    <>
      <iframe
        ref={iframe0Ref}
        title="UI snapshot A"
        sandbox="allow-same-origin"
        className={`preview-iframe${front === 0 ? ' is-front' : ' is-back'}${
          hasPainted ? '' : ' is-pending'
        }`}
      />
      <iframe
        ref={iframe1Ref}
        title="UI snapshot B"
        sandbox="allow-same-origin"
        className={`preview-iframe${front === 1 ? ' is-front' : ' is-back'}${
          hasPainted ? '' : ' is-pending'
        }`}
      />
      {empty ? <div className="empty preview-empty">No snapshot</div> : null}
    </>
  );
}
