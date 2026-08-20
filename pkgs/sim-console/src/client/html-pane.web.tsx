/**
 * Web HTML snapshot preview (iframe + srcdoc). Native falls back to
 * `html-pane.tsx` ("HTML preview requires web.").
 */
import { Box, Text } from '@pkgs/ui';
import { useEffect, useState } from 'react';

import type { ReportApiClient } from './api-client';
import type { FlatFrame } from './frames';
import { HtmlSrcdocFrame } from './html-srcdoc-frame';
import { resolveHtmlFile, type TopologyNodeInfo } from './node-views';
import { loadPreviewFontCss, SNAPSHOT_SHELL_CSS } from './preview-fonts';
import { patchPreviewHtml } from './preview-html';
import { emptySx, paneSx } from './tokens';

export function HtmlPane(props: {
  readonly api: ReportApiClient;
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly frame: FlatFrame | null;
  readonly nodeId: string | null;
  readonly node: TopologyNodeInfo | null;
}) {
  const fetchFn = props.api.fetch;
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
          fetchFn(url),
          loadPreviewFontCss((input, init) => fetchFn(input, init)),
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
  }, [file, fetchFn, props.api, props.bucketId, props.runId, props.testId]);

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

  return <HtmlSrcdocFrame title={`frame ${file}`} srcdoc={srcdoc} />;
}
