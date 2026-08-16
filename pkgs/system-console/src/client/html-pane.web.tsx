/**
 * Web HTML snapshot preview (iframe + srcdoc). Native falls back to
 * `html-pane.tsx` ("HTML preview requires web.").
 */
import { useIo } from '@pkgs/io';
import { Box, Text } from '@pkgs/ui';
import { useEffect, useState } from 'react';

import type { ReportApiClient } from './api-client';
import type { FlatFrame } from './frames';
import { resolveHtmlFile, type TopologyNodeInfo } from './node-views';
import { loadPreviewFontCss, SNAPSHOT_SHELL_CSS } from './preview-fonts';
import { patchPreviewHtml } from './preview-html';
import { emptySx, paneSx } from './tokens';

const PREVIEW_IFRAME_CLASS = 'system-console-html-preview';

/** CSS for the iframe host — avoid RN `style=` (ci:no-rn-style-api). */
const PREVIEW_IFRAME_CSS = `
.${PREVIEW_IFRAME_CLASS} {
  flex: 1;
  width: 100%;
  height: 100%;
  border: 0;
  background: hsla(240, 5%, 4%, 1);
}
`;

export function HtmlPane(props: {
  readonly api: ReportApiClient;
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly frame: FlatFrame | null;
  readonly nodeId: string | null;
  readonly node: TopologyNodeInfo | null;
}) {
  const io = useIo();
  const [srcdoc, setSrcdoc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const file = resolveHtmlFile(props.frame, props.nodeId, props.node);

  useEffect(() => {
    if (file == null) {
      setSrcdoc(null);
      setError(null);
      return;
    }
    let cancelled = false;
    const url = props.api.testFrameUrl(
      props.bucketId,
      props.runId,
      props.testId,
      file
    );
    void (async () => {
      try {
        const [res, fontCss] = await Promise.all([
          io.http.fetch(url),
          loadPreviewFontCss((input, init) => io.http.fetch(input, init)),
        ]);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        if (cancelled) return;
        setSrcdoc(
          patchPreviewHtml(html, {
            shellCss: SNAPSHOT_SHELL_CSS,
            fontCss,
          })
        );
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setSrcdoc(null);
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file, io.http, props.api, props.bucketId, props.runId, props.testId]);

  if (file == null) {
    return (
      <Box sx={paneSx}>
        <Text sx={emptySx}>
          No HTML snapshot for node `{props.nodeId ?? '—'}` on this frame.
        </Text>
      </Box>
    );
  }
  if (error != null) {
    return (
      <Box sx={paneSx}>
        <Text sx={emptySx}>Failed to load snapshot: {error}</Text>
      </Box>
    );
  }
  if (srcdoc == null) {
    return (
      <Box sx={paneSx}>
        <Text sx={emptySx}>Loading snapshot…</Text>
      </Box>
    );
  }

  return (
    <Box sx={paneSx}>
      <style>{PREVIEW_IFRAME_CSS}</style>
      <iframe
        className={PREVIEW_IFRAME_CLASS}
        title={`frame ${file}`}
        srcDoc={srcdoc}
        sandbox=""
      />
    </Box>
  );
}
