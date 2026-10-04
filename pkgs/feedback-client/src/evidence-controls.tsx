/** @jsxImportSource solid-js */
import { IconButton } from '@pkgs/ui-client/icon-button';
import { MonitorPlayIcon, PaperclipIcon, Trash2Icon, XIcon } from '@pkgs/ui-client/icons';
import { Show } from 'solid-js';
import type { EvidenceFile } from '@pkgs/feedback-shared/types';
import type { FeedbackController } from './controller';
import { useFeedbackState, useRecordingState } from './use-feedback-state';

export function EvidenceControls(props: { controller: FeedbackController }) {
  const recording = useRecordingState(() => props.controller);
  const state = useFeedbackState(() => props.controller);
  let chooser: HTMLInputElement | undefined;
  const busy = () =>
    state().phase === 'sending' ||
    recording().phase === 'starting' ||
    recording().phase === 'stopping';
  const attachmentLabel = () =>
    `${state().files.length} ${state().files.length === 1 ? 'attachment' : 'attachments'}`;
  return (
    <div
      class="box flex-row flex-wrap items-center gap-1"
      data-component="FeedbackEvidenceControls"
    >
      <IconButton
        tooltip="default"
        tooltipFloating
        tooltipPlacement="top-start"
        label={
          recording().phase === 'ready'
            ? 'Discard recording'
            : 'Record reproduction'
        }
        size={32}
        disabled={busy()}
        onClick={() => {
          if (recording().phase === 'ready')
            props.controller.recorder.discard();
          else void props.controller.recorder.start();
        }}
        dataSet={{
          testid:
            recording().phase === 'ready'
              ? 'feedback-discard'
              : 'feedback-record',
        }}
      >
        <Show
          when={recording().phase === 'ready'}
          fallback={<MonitorPlayIcon size={18} />}
        >
          <Trash2Icon size={18} />
        </Show>
      </IconButton>
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
      <IconButton
        label="Attach screenshot or video"
        tooltip="default"
        tooltipFloating
        tooltipPlacement="top-start"
        size={32}
        disabled={state().phase === 'sending'}
        onClick={() => chooser?.click()}
        dataSet={{ testid: 'feedback-attach' }}
      >
        <PaperclipIcon size={18} />
      </IconButton>
      <Show when={state().files.length > 0}>
        <p class="text textCaption whitespace-nowrap">{attachmentLabel()}</p>
        <IconButton
          label="Remove latest attachment"
          tooltip="default"
          tooltipFloating
          tooltipPlacement="top-start"
          size={32}
          disabled={state().phase === 'sending'}
          onClick={() => props.controller.removeFile(state().files.length - 1)}
          dataSet={{ testid: 'feedback-remove-attachment' }}
        >
          <XIcon size={16} />
        </IconButton>
      </Show>
      <Show when={recording().phase === 'ready'}>
        <p class="text textCaption whitespace-nowrap">Reproduction ready</p>
      </Show>
      <Show when={recording().notice}>
        <p class="text textCaption" role="status">
          {recording().notice}
        </p>
      </Show>
    </div>
  );
}

async function attachFile(
  controller: FeedbackController,
  file: File
): Promise<void> {
  if (file.size > 12 * 1024 * 1024) {
    controller.reportAttachmentError(
      'Keep attachments under 12 MB. Choose a shorter recording.'
    );
    return;
  }
  try {
    const evidence: EvidenceFile = {
      name: file.name,
      contentType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    };
    await controller.attach(evidence);
  } catch {
    controller.reportAttachmentError(
      'The attachment could not be read. Choose it again.'
    );
  }
}
