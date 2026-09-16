import type { HtmlReportTest } from '@pkgs/sim';
import { For, Show } from 'solid-js';
import {
  blobHeading,
  downloadUrl,
  fileName,
  formatBlobBody,
} from '../lib/format';
import type { FlatFrame } from '../lib/frames';
import { stageBlobs } from '../lib/frames';

export function DocStage(props: {
  test: HtmlReportTest;
  selected: FlatFrame | null;
}) {
  const blobs = () => stageBlobs(props.selected);

  return (
    <Show
      when={blobs().length > 0}
      fallback={
        <div class="sr-nodata">
          {props.selected
            ? 'No snapshots in this frame'
            : 'This test captured no frames'}
        </div>
      }
    >
      <div class="sr-stage doc">
        <For each={blobs()}>
          {(blob) => (
            <div class="sr-doc-card" data-doc-file={blob.file}>
              <h3>{blobHeading(blob)}</h3>
              <Show when={blob.media === 'bytes'}>
                <Show when={downloadUrl(props.test, blob)}>
                  {(url) => (
                    <a
                      class="sr-doc-download"
                      href={url()}
                      download={fileName(blob.file)}
                    >
                      {`Download ${fileName(blob.file)}`}
                    </a>
                  )}
                </Show>
              </Show>
              <pre class="sr-doc-body" data-doc-body="">
                {formatBlobBody(props.test, blob)}
              </pre>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}
