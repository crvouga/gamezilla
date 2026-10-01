import type { HtmlReportTest, ReportSnapshotBlob } from '@pkgs/harness';
import { For } from 'solid-js';

import { blobHeading, formatBlobBody } from '../lib/format';

/** Raw text of the frame's non-UI snapshots, beside the phones. */
export function SnapshotsAside(props: {
  test: HtmlReportTest;
  blobs: ReportSnapshotBlob[];
}) {
  return (
    <div class="sr-aside">
      <For each={props.blobs}>
        {(blob) => (
          <>
            <h3>{blobHeading(blob)}</h3>
            <pre>{formatBlobBody(props.test, blob)}</pre>
          </>
        )}
      </For>
    </div>
  );
}
