import { createEffect, createSignal, Match, onCleanup, Switch } from 'solid-js';

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

/** Web HTML snapshot preview (in-DOM host). */
export function HtmlPane(props: {
  readonly api: ReportApiClient;
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly frame: FlatFrame | null;
  readonly nodeId: string | null;
  readonly node: TopologyNodeInfo | null;
}) {
  const file = () => resolveHtmlFile(props.frame, props.nodeId, props.node);
  const media = () =>
    props.frame?.snapshots.find((s) => s.file === file())?.media ?? 'html';
  const pngUrl = () => {
    const f = file();
    if (f == null) return null;
    return props.api.testFrameUrl(props.bucketId, props.runId, props.testId, f);
  };
  return (
    <Switch>
      <Match when={file() == null}>
        <HtmlPaneEmpty kind="missing" nodeId={props.nodeId} />
      </Match>
      <Match when={media() === 'png' && pngUrl() != null}>
        <HtmlSrcdocFrame
          title={`frame ${file()}`}
          srcdoc={`<!doctype html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#111"><img src="${pngUrl()}" alt="" style="max-width:100%;max-height:100vh;object-fit:contain"/></body></html>`}
        />
      </Match>
      <Match when={file() != null}>
        <HtmlPaneHtml
          file={file() ?? ''}
          api={props.api}
          bucketId={props.bucketId}
          runId={props.runId}
          testId={props.testId}
          nodeId={props.nodeId}
        />
      </Match>
    </Switch>
  );
}

function HtmlPaneHtml(props: {
  readonly file: string;
  readonly api: ReportApiClient;
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly nodeId: string | null;
}) {
  const state = useHtmlPaneSrcdoc({
    file: () => props.file,
    fetchFn: () => props.api.fetch,
    api: () => props.api,
    bucketId: () => props.bucketId,
    runId: () => props.runId,
    testId: () => props.testId,
  });

  return (
    <Switch>
      <Match when={state.blankSnapshot && state.srcdoc == null}>
        <HtmlPaneEmpty kind="blank" nodeId={props.nodeId} />
      </Match>
      <Match when={state.srcdoc == null && state.error != null}>
        <HtmlPaneEmpty kind="error" detail={state.error ?? ''} />
      </Match>
      <Match when={state.srcdoc == null}>
        <HtmlPaneEmpty kind="loading" />
      </Match>
      <Match when={true}>
        <HtmlSrcdocFrame
          title={`frame ${props.file}`}
          srcdoc={state.srcdoc ?? ''}
        />
      </Match>
    </Switch>
  );
}

function useHtmlPaneSrcdoc(args: {
  readonly file: () => string | null;
  readonly fetchFn: () => ReportApiClient['fetch'];
  readonly api: () => ReportApiClient;
  readonly bucketId: () => string;
  readonly runId: () => string;
  readonly testId: () => string;
}): {
  readonly srcdoc: string | null;
  readonly error: string | null;
  readonly blankSnapshot: boolean;
} {
  const [srcdoc, setSrcdoc] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [blankSnapshot, setBlankSnapshot] = createSignal(false);

  createEffect(() => {
    const file = args.file();
    const fetchFn = args.fetchFn();
    const api = args.api();
    const bucketId = args.bucketId();
    const runId = args.runId();
    const testId = args.testId();
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
    onCleanup(() => {
      cancelled = true;
    });
  });

  return {
    get srcdoc() {
      return srcdoc();
    },
    get error() {
      return error();
    },
    get blankSnapshot() {
      return blankSnapshot();
    },
  };
}
