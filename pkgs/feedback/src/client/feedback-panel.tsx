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
    <div class="box gap-4 p-5" data-component="FeedbackPanel">
      <div
        class="box flex-row gap-2"
        role="navigation"
        aria-label="Feedback wizard"
      >
        <Button
          title="1 · Write"
          variant={workspace().stage === 'write' ? 'solid' : 'ghost'}
          size="sm"
          onClick={() => props.controller.setStage('write')}
          dataSet={{ testid: 'feedback-write' }}
        />
        <Button
          title="2 · Review"
          variant={workspace().stage === 'review' ? 'solid' : 'ghost'}
          size="sm"
          onClick={() => props.controller.setStage('review')}
          dataSet={{ testid: 'feedback-review' }}
        />
        <Button
          title="Manage"
          variant={workspace().stage === 'manage' ? 'solid' : 'ghost'}
          size="sm"
          onClick={() => {
            void props.controller.manage();
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
              body="Your report and context are safe. You can keep working or find it in Manage."
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
      <p class="text textCaption" role="status" aria-live="polite">
        {warning()
          ? 'Draft needs saving'
          : 'Draft kept on this device · close whenever you need'}
      </p>
    </div>
  );
}
