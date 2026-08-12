import { useEffect, useRef, useState } from 'react';

import { loadPreviewFontCss } from './preview-fonts';
import { patchPreviewHtml } from './preview-html';
import { reportFetch } from './wall';

/**
 * One persistent iframe; frame HTML is applied via `srcdoc` so scrubbing does
 * not remount the document chrome or re-trigger Google Fonts FOUT.
 */
export function PreviewFrame(props: { readonly src: string | null }) {
  const { src } = props;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const genRef = useRef(0);
  const [empty, setEmpty] = useState(src === null);

  useEffect(() => {
    if (src === null) {
      genRef.current += 1;
      setEmpty(true);
      const iframe = iframeRef.current;
      if (iframe !== null) iframe.srcdoc = '';
      return;
    }

    const gen = ++genRef.current;
    let cancelled = false;

    void (async () => {
      const [htmlRes, fontCss] = await Promise.all([
        reportFetch(src),
        loadPreviewFontCss(),
      ]);
      if (cancelled || gen !== genRef.current) return;
      if (!htmlRes.ok) {
        setEmpty(true);
        return;
      }
      const html = await htmlRes.text();
      if (cancelled || gen !== genRef.current) return;
      const iframe = iframeRef.current;
      if (iframe === null) return;
      iframe.srcdoc = patchPreviewHtml(html, fontCss);
      setEmpty(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <>
      <iframe ref={iframeRef} title="UI snapshot" sandbox="allow-same-origin" />
      {empty ? <div className="empty preview-empty">No snapshot</div> : null}
    </>
  );
}
