/**
 * Web iframe host that writes snapshot HTML in place via `contentDocument`
 * so scrubbing does not trigger a parent-tab navigation loading spinner.
 * Native falls back to `html-srcdoc-frame.tsx`.
 */
import { Box, Text } from '@pkgs/ui';
import { useEffect, useRef } from 'react';

import { emptySx, paneSx } from './tokens';

const PREVIEW_IFRAME_CLASS = 'sim-console-html-preview';

const PREVIEW_IFRAME_CSS = `
.${PREVIEW_IFRAME_CLASS} {
  flex: 1;
  width: 100%;
  height: 100%;
  border: 0;
  background: hsla(240, 5%, 4%, 1);
}
`;

/** allow-same-origin so the parent can document.write; no allow-scripts. */
const PREVIEW_SANDBOX = 'allow-same-origin';

function writeIframeDocument(iframe: HTMLIFrameElement, html: string): void {
  const doc = iframe.contentDocument;
  if (doc == null) return;
  doc.open();
  doc.write(html);
  doc.close();
}

export function HtmlSrcdocFrame(props: {
  readonly title: string;
  readonly srcdoc: string | null;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const pendingHtmlRef = useRef<string | null>(null);

  useEffect(() => {
    const html = props.srcdoc;
    if (html == null || html.length === 0) {
      pendingHtmlRef.current = null;
      return;
    }
    const iframe = iframeRef.current;
    if (iframe == null) {
      pendingHtmlRef.current = html;
      return;
    }
    writeIframeDocument(iframe, html);
    pendingHtmlRef.current = null;
  }, [props.srcdoc]);

  if (props.srcdoc == null || props.srcdoc.length === 0) {
    return (
      <Box sx={paneSx}>
        <Text sx={emptySx}>No HTML snapshot for this frame.</Text>
      </Box>
    );
  }

  return (
    <Box sx={paneSx}>
      <style>{PREVIEW_IFRAME_CSS}</style>
      <iframe
        ref={(node) => {
          iframeRef.current = node;
          if (node == null) return;
          const pending = pendingHtmlRef.current;
          if (pending != null) {
            writeIframeDocument(node, pending);
            pendingHtmlRef.current = null;
          }
        }}
        className={PREVIEW_IFRAME_CLASS}
        title={props.title}
        sandbox={PREVIEW_SANDBOX}
      />
    </Box>
  );
}
