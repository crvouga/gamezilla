import {
  blobHeading,
  formatBlobBody,
} from '@pkgs/harness-report-shared/format';
import type { HtmlReportTest } from '@pkgs/harness-root-shared/bundle';
import type { ReportSnapshotBlob } from '@pkgs/harness-root-shared/report-types';
import { DocumentPanel } from '@pkgs/ui-root-client/document-panel';
import { For } from 'solid-js';

/** Raw text of the frame's non-UI snapshots, beside the phones. */
export function SnapshotsAside(props: {
  test: HtmlReportTest;
  blobs: ReportSnapshotBlob[];
}) {
  return (
    <div class="box gap-3 min-w-0">
      <For each={props.blobs}>
        {(blob) => (
          <DocumentPanel
            title={blobHeading(blob)}
            content={formatBlobBody(props.test, blob)}
          />
        )}
      </For>
    </div>
  );
}
