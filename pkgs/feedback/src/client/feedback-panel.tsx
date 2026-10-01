/** @jsxImportSource solid-js */
import { Button, SuccessState } from '@pkgs/ui';
import { Show } from 'solid-js';
import type { FeedbackController } from './controller';
import { FeedbackForm } from './feedback-form';
import { FeedbackManagement } from './feedback-management';
import { useFeedbackState } from './use-feedback-state';

export function FeedbackPanel(props: { controller: FeedbackController }) {
  const state = useFeedbackState(() => props.controller);
  const workspace = () => {
    state();
    return props.controller.workspace.state();
  };
  const warning = () => {
    state();
    return props.controller.workspace.warning;
  };
  return (
    <div class="box gap-4 p-4" data-component="FeedbackPanel">
      <div class="box flex-row items-center justify-between gap-3">
        <div class="box gap-0.5">
          <h2 class="text font-semibold">
            {workspace().stage === 'manage' ? 'Your feedback' : 'New feedback'}
          </h2>
          <p class="text textCaption">Saved on this device</p>
        </div>
        <Button
          title={workspace().stage === 'manage' ? 'Back to writing' : 'History'}
          variant="ghost"
          size="sm"
          onClick={() => {
            if (workspace().stage === 'manage')
              props.controller.setStage('write');
            else void props.controller.manage();
          }}
          dataSet={{ testid: 'feedback-manage' }}
        />
      </div>
      <Show when={warning()}>
        <div
          class="box gap-2 rounded-lg border border-destructive p-3"
          role="alert"
        >
          <p class="text text-sm text-destructive">{warning()}</p>
          <Button
            title="Try saving again"
            variant="outline"
            size="sm"
            onClick={() => {
              props.controller.workspace.retrySave();
              props.controller.setStage(workspace().stage);
            }}
          />
        </div>
      </Show>
      <Show
        when={workspace().stage === 'manage'}
        fallback={
          <Show
            when={state().phase === 'saved'}
            fallback={
              <FeedbackForm controller={props.controller} state={state} />
            }
          >
            <SuccessState
              title="Feedback saved"
              body="Your report and context are safe."
              action={{
                label: 'Your feedback',
                onClick: () => {
                  void props.controller.manage();
                },
              }}
              variant="compact"
            />
            <Button
              title="Write another"
              variant="outline"
              onClick={() => {
                void props.controller.newDraft();
              }}
            />
          </Show>
        }
      >
        <FeedbackManagement controller={props.controller} state={state} />
      </Show>
      <Show when={warning()}>
        <p class="text textCaption" role="status" aria-live="polite">
          Draft needs saving
        </p>
      </Show>
    </div>
  );
}
