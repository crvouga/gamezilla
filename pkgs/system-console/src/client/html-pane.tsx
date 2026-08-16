import { Box, Text } from '@pkgs/ui';

import type { ReportApiClient } from './api-client';
import type { FlatFrame } from './frames';
import { resolveHtmlFile, type TopologyNodeInfo } from './node-views';
import { emptySx, paneSx } from './tokens';

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
    return (
      <Box sx={paneSx}>
        <Text sx={emptySx}>
          No HTML snapshot for node `{props.nodeId ?? '—'}` on this frame.
        </Text>
      </Box>
    );
  }
  return (
    <Box sx={paneSx}>
      <Text sx={emptySx}>HTML preview requires web.</Text>
    </Box>
  );
}
