/**
 * Web HTML snapshot preview (in-DOM host). Native falls back to
 * `html-pane.tsx` ("HTML preview requires web.").
 */
import { useEffect, useState } from 'react';

import type { ReportApiClient } from './api-client';
import type { FlatFrame } from './frames';
import { HtmlPaneEmpty } from './html-pane-empty';
import { HtmlSrcdocFrame } from './html-srcdoc-frame';
import { resolveHtmlFile, type TopologyNodeInfo } from './node-views';
import { loadPreviewFontCss } from './preview-fonts';
import { PREVIEW_IN_DOM_SHELL_CSS } from './preview-frame-css';
import {
  isBlankSnapshotBody,
  prepareSnapshotHtml,
  snapshotBodyHtml,
} from './preview-html';

/** Prepared in-DOM markup keyed by frame URL — survives scrub across panes. */
const preparedMarkupCache = new Map<string, string>();
/** Last non-blank prepared markup per frame URL (hold while parked actor omits a view). */
const lastGoodMarkupCache = new Map<string, string>();

function useHtmlPaneSrcdoc(args: {
  readonly file: string | null;
  readonly fetchFn: ReportApiClient['fetch'];
  readonly api: ReportApiClient;
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
}) {
  const [srcdoc, setSrcdoc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blankSnapshot, setBlankSnapshot] = useState(false);

  useEffect(() => {
    const { file, fetchFn, api, bucketId, runId, testId } = args;
    if (file == null) {
      setSrcdoc(null);
      setError(null);
      setBlankSnapshot(false);
      return;
    }
    let cancelled = false;
    const url = api.testFrameUrl(bucketId, runId, testId, file);

    const applyPrepared = (prepared: string, bodyHtml: string) => {
      if (cancelled) return;
      if (isBlankSnapshotBody(bodyHtml)) {
        const held = lastGoodMarkupCache.get(url);
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
      lastGoodMarkupCache.set(url, prepared);
      setBlankSnapshot(false);
      setSrcdoc((prev) => (prev === prepared ? prev : prepared));
      setError(null);
    };

    const cached = preparedMarkupCache.get(url);
    if (cached !== undefined) {
      applyPrepared(cached, snapshotBodyHtml(cached));
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
        const payload = prepareSnapshotHtml(html, {
          shellCss: PREVIEW_IN_DOM_SHELL_CSS,
          fontCss,
        });
        const prepared = `${payload.styleHtml}${payload.bodyHtml}`;
        preparedMarkupCache.set(url, prepared);
        applyPrepared(prepared, payload.bodyHtml);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    args.file,
    args.fetchFn,
    args.api,
    args.bucketId,
    args.runId,
    args.testId,
  ]);

  return { srcdoc, error, blankSnapshot };
}

export function HtmlPane(props: {
  readonly api: ReportApiClient;
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly frame: FlatFrame | null;
  readonly nodeId: string | null;
  readonly node: TopologyNodeInfo | null;
}) {
  const file = resolveHtmlFile(props.frame, props.nodeId, props.node);
  const { srcdoc, error, blankSnapshot } = useHtmlPaneSrcdoc({
    file,
    fetchFn: props.api.fetch,
    api: props.api,
    bucketId: props.bucketId,
    runId: props.runId,
    testId: props.testId,
  });

  if (file == null) {
    return <HtmlPaneEmpty kind="missing" nodeId={props.nodeId} />;
  }
  if (blankSnapshot && srcdoc == null) {
    return <HtmlPaneEmpty kind="blank" nodeId={props.nodeId} />;
  }
  if (srcdoc == null && error != null) {
    return <HtmlPaneEmpty kind="error" detail={error} />;
  }
  if (srcdoc == null) {
    return <HtmlPaneEmpty kind="loading" />;
  }

  return <HtmlSrcdocFrame title={`frame ${file}`} srcdoc={srcdoc} />;
}
