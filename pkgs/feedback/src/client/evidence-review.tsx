/** @jsxImportSource solid-js */
import { Button } from '@pkgs/ui';
import { createMemo, For, onCleanup, Show } from 'solid-js';
import type { EvidenceFile } from '../shared/types';
import type { FeedbackController } from './controller';
import { useFeedbackState, useRecordingState } from './use-feedback-state';

function MediaPreview(props: {
  controller: FeedbackController;
  file: EvidenceFile;
}) {
  const preview = createMemo(() => {
    const value = props.controller.preview(props.file);
    onCleanup(() => value?.dispose());
    return value;
  });
  return (
    <Show when={preview()}>
      <a
        class="text textCaption text-tint"
        href={preview()?.url}
        download={props.file.name}
      >
        Save {props.file.name}
      </a>
      <Show
        when={props.file.contentType.startsWith('video/')}
        fallback={
          <img
            src={preview()?.url}
            alt={props.file.name}
            class="max-w-full rounded-md"
          />
        }
      >
        <video
          src={preview()?.url}
          controls
          playsinline
          preload="metadata"
          class="max-w-full rounded-md"
        >
          <track kind="captions" />
        </video>
      </Show>
    </Show>
  );
}
export function EvidenceReview(props: { controller: FeedbackController }) {
  const recording = useRecordingState(() => props.controller);
  const state = useFeedbackState(() => props.controller);
  let chooser: HTMLInputElement | undefined;
  return (
    <div class="box gap-2" data-component="FeedbackEvidenceReview">
      <Show
        when={recording().phase === 'ready'}
        fallback={
          <Button
            title="Record reproduction"
            variant="outline"
            disabled={
              recording().phase !== 'idle' || state().phase === 'sending'
            }
            onClick={() => {
              void props.controller.recorder.start();
            }}
            dataSet={{ testid: 'feedback-record' }}
          />
        }
      >
        <p class="text" data-testid="feedback-recording-review">
          Reproduction ready · {recording().recording?.actions.length ?? 0}{' '}
          actions. Review the steps above before sending.
        </p>
        <Show when={recording().video} keyed>
          {(file) => <MediaPreview controller={props.controller} file={file} />}
        </Show>
        <Button
          title="Discard recording"
          variant="outline"
          disabled={state().phase === 'sending'}
          onClick={() => props.controller.recorder.discard()}
          dataSet={{ testid: 'feedback-discard' }}
        />
      </Show>
      <Show
        when={
          recording().phase === 'starting' || recording().phase === 'stopping'
        }
      >
        <Button
          title="Cancel recording"
          variant="outline"
          onClick={() => props.controller.recorder.discard()}
        />
      </Show>
      <Show when={recording().recording?.truncated}>
        <p class="text textCaption">
          The recording reached its action limit. Add any remaining steps above.
        </p>
      </Show>
      <Show when={recording().notice}>
        <p class="text textCaption" role="status">
          {recording().notice}
        </p>
      </Show>
      <p class="text textCaption">
        Recording captures actions in this app. If your device offers screen
        sharing, choose the app tab. No microphone audio is recorded.
      </p>
      <input
        ref={chooser}
        type="file"
        accept="image/png,image/jpeg,image/webp,video/webm,video/mp4,video/quicktime"
        class="hidden"
        aria-label="Attach a screenshot or video"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) void attachFile(props.controller, file);
          event.currentTarget.value = '';
        }}
      />
      <Button
        title="Attach screenshot or video"
        variant="outline"
        disabled={state().phase === 'sending'}
        onClick={() => chooser?.click()}
      />
      <For each={state().files}>
        {(file, index) => (
          <div class="box gap-1">
            <p class="text textCaption">{file.name}</p>
            <MediaPreview controller={props.controller} file={file} />
            <Button
              title="Remove attachment"
              variant="outline"
              disabled={state().phase === 'sending'}
              onClick={() => props.controller.removeFile(index())}
            />
          </div>
        )}
      </For>
    </div>
  );
}

async function attachFile(
  controller: FeedbackController,
  file: File
): Promise<void> {
  controller.attach({
    name: file.name,
    contentType: file.type,
    bytes: new Uint8Array(await file.arrayBuffer()),
  });
}
