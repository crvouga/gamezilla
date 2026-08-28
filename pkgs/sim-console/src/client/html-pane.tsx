import type { ReportApiClient } from './api-client';
import type { FlatFrame } from './frames';
import { HtmlPaneEmpty } from './html-pane-empty';
import { resolveHtmlFile, type TopologyNodeInfo } from './node-views';

/**
 * Native-safe HTML preview fallback. The DOM iframe renderer is web-only
 * (`html-pane.web.tsx` via Metro platform resolution).
 */
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
  if (file == null) {
    return <HtmlPaneEmpty kind="missing" nodeId={props.nodeId} />;
  }
  return <HtmlPaneEmpty kind="unsupported" />;
}
