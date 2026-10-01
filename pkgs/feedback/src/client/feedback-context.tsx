/** @jsxImportSource solid-js */
import { Button } from '@pkgs/ui';
import { type Accessor, For } from 'solid-js';
import type { FeedbackController, FeedbackState } from './controller';
import { EvidenceReview } from './evidence-review';

export function FeedbackContext(props: {
  controller: FeedbackController;
  state: Accessor<FeedbackState>;
}) {
  const attachments = () => {
    props.state();
    return props.controller.workspace.active()?.report?.attachments ?? [];
  };
  return (
    <div class="box gap-4" data-component="FeedbackContext">
      <EvidenceReview controller={props.controller} />
      <For each={attachments()}>
        {(file) => (
          <div class="box flex-row items-center justify-between gap-2">
            <a
              class="text text-sm text-tint truncate"
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {file.name}
            </a>
            <Button
              title="Remove"
              size="sm"
              variant="ghost"
              onClick={() => props.controller.removeRemoteAttachment(file.id)}
            />
          </div>
        )}
      </For>
      <p class="text textCaption">
        Diagnostics are included automatically. Recordings and attachments are
        optional.
      </p>
    </div>
  );
}
