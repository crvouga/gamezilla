import {
  blobHeading,
  formatBlobBody,
} from '@pkgs/harness-report-shared/format';
import type { HtmlReportTest } from '@pkgs/harness-shared/bundle';
import type { ReportSnapshotBlob } from '@pkgs/harness-shared/report-types';
import { For } from 'solid-js';

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
