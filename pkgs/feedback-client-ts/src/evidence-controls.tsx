/** @jsxImportSource solid-js */

import type { EvidenceFile } from '@pkgs/feedback-shared-ts/types';
import { FileTrigger } from '@pkgs/ui-root-client-ts/file-trigger';
import { IconButton } from '@pkgs/ui-root-client-ts/icon-button';
import {
  MonitorPlayIcon,
  PaperclipIcon,
  Trash2Icon,
  XIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { Show } from 'solid-js';
import type { FeedbackController } from './controller';
import { useFeedbackState, useRecordingState } from './use-feedback-state';

export function EvidenceControls(props: { controller: FeedbackController }) {
  const recording = useRecordingState(() => props.controller);
  const state = useFeedbackState(() => props.controller);
  const busy = () =>
    state().phase === 'sending' ||
    recording().phase === 'starting' ||
    recording().phase === 'stopping';
  const attachmentLabel = () =>
    `${state().files.length} ${state().files.length === 1 ? 'attachment' : 'attachments'}`;
  return (
    <StackHorizontal
      wrap
      align="center"
      gap="xs"
      testId="feedback-evidence-controls"
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
      <FileTrigger
        label="Attach a screenshot or video"
        accept="image/png,image/jpeg,image/webp,video/webm,video/mp4,video/quicktime"
        onSelect={(file) => {
          void attachFile(props.controller, file);
        }}
      >
        {(open) => (
          <IconButton
            label="Attach screenshot or video"
            tooltip="default"
            tooltipFloating
            tooltipPlacement="top-start"
            size={32}
            disabled={state().phase === 'sending'}
            onClick={open}
            dataSet={{ testid: 'feedback-attach' }}
          >
            <PaperclipIcon size={18} />
          </IconButton>
        )}
      </FileTrigger>
      <Show when={state().files.length > 0}>
        <P variant="caption" wrap="nowrap">
          {attachmentLabel()}
        </P>
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
        <P variant="caption" wrap="nowrap">
          Reproduction ready
        </P>
      </Show>
      <Show when={recording().notice}>
        <P variant="caption" role="status">
          {recording().notice}
        </P>
      </Show>
    </StackHorizontal>
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
