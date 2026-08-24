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
import { PREVIEW_STRETCH_SHELL_CSS } from './preview-frame-css';
import { loadPreviewFontCss } from './preview-fonts';
import {
  isBlankSnapshotBody,
  patchPreviewHtml,
  snapshotBodyHtml,
} from './preview-html';
import { emptySx, paneSx } from './tokens';

/** Patched srcdoc keyed by frame URL — survives scrub across panes. */
const patchedSrcdocCache = new Map<string, string>();
/** Last non-blank patched srcdoc per frame URL (hold while parked actor omits a view). */
const lastGoodSrcdocCache = new Map<string, string>();

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
  const [blankSnapshot, setBlankSnapshot] = useState(false);
  const file = resolveHtmlFile(props.frame, props.nodeId, props.node);

  useEffect(() => {
    if (file == null) {
      setSrcdoc(null);
      setError(null);
      setBlankSnapshot(false);
      return;
    }
    let cancelled = false;
    const url = props.api.testFrameUrl(
      props.bucketId,
      props.runId,
      props.testId,
      file
    );

    const applyPatched = (patched: string) => {
      if (cancelled) return;
      if (isBlankSnapshotBody(snapshotBodyHtml(patched))) {
        const held = lastGoodSrcdocCache.get(url);
        if (held !== undefined) {
          setBlankSnapshot(false);
          setSrcdoc((prev) => (prev === held ? prev : held));
          setError(null);
          return;
        }
        setBlankSnapshot(true);
        setError(null);
        return;
      }
      lastGoodSrcdocCache.set(url, patched);
      setBlankSnapshot(false);
      setSrcdoc((prev) => (prev === patched ? prev : patched));
      setError(null);
    };

    const cached = patchedSrcdocCache.get(url);
    if (cached !== undefined) {
      applyPatched(cached);
      return;
    }

    void (async () => {
      try {
        const [res, fontCss] = await Promise.all([
          fetchFn(url),
          loadPreviewFontCss((input, init) => fetchFn(input, init)),
        ]);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        if (cancelled) return;
        const patched = patchPreviewHtml(html, {
          shellCss: PREVIEW_STRETCH_SHELL_CSS,
          fontCss,
        });
        patchedSrcdocCache.set(url, patched);
        applyPatched(patched);
      } catch (err) {
        if (cancelled) return;
        // Keep prior srcdoc on transient fetch errors while scrubbing.
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
          No snapshot for `{props.nodeId ?? '—'}` on this step.
        </Text>
      </Box>
    );
  }
  if (blankSnapshot && srcdoc == null) {
    return (
      <Box sx={paneSx}>
        <Text sx={emptySx}>
          Snapshot for `{props.nodeId ?? '—'}` is empty on this step.
        </Text>
      </Box>
    );
  }
  if (srcdoc == null && error != null) {
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
