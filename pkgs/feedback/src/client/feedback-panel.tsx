/** @jsxImportSource solid-js */
import { Button, SuccessState } from '@pkgs/ui';
import { Match, Show, Switch } from 'solid-js';
import type { FeedbackController } from './controller';
import { FeedbackContext } from './feedback-context';
import { FeedbackDetail } from './feedback-detail';
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
  const title = () => {
    if (workspace().stage === 'manage') return 'Feedback';
    if (workspace().stage === 'read') return 'Feedback detail';
    if (workspace().stage === 'context') return 'Add context';
    return props.controller.workspace.active()?.report
      ? 'Edit feedback'
      : 'New feedback';
  };
  return (
    <div class="box gap-4 p-4" data-component="FeedbackPanel">
      <div class="box flex-row items-center justify-between gap-3">
        <h2 class="text font-semibold">{title()}</h2>
        <StageAction controller={props.controller} stage={workspace().stage} />
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
      <Switch>
        <Match when={workspace().stage === 'manage'}>
          <FeedbackManagement controller={props.controller} state={state} />
        </Match>
        <Match when={workspace().stage === 'read'}>
          <FeedbackDetail controller={props.controller} state={state} />
        </Match>
        <Match when={workspace().stage === 'context'}>
          <FeedbackContext controller={props.controller} state={state} />
        </Match>
        <Match when={state().phase === 'saved'}>
          <SuccessState
            title="Feedback saved"
            body="Your report and context are safe."
            action={{
              label: 'View feedback',
              onClick: () => props.controller.setStage('read'),
            }}
            variant="compact"
          />
        </Match>
        <Match when={workspace().stage === 'write'}>
          <FeedbackForm controller={props.controller} state={state} />
        </Match>
      </Switch>
    </div>
  );
}

function StageAction(props: {
  controller: FeedbackController;
  stage: 'write' | 'manage' | 'read' | 'context';
}) {
  return (
    <Switch>
      <Match when={props.stage === 'manage'}>
        <Button
          title="New"
          variant="ghost"
          size="sm"
          onClick={() => {
            void props.controller.newDraft();
          }}
          dataSet={{ testid: 'feedback-new' }}
        />
      </Match>
      <Match when={props.stage === 'read'}>
        <Button
          title="Back"
          variant="ghost"
          size="sm"
          onClick={() => {
            void props.controller.manage();
          }}
          dataSet={{ testid: 'feedback-back' }}
        />
      </Match>
      <Match when={props.stage === 'context'}>
        <Button
          title="Done"
          variant="ghost"
          size="sm"
          onClick={() => props.controller.setStage('write')}
          dataSet={{ testid: 'feedback-context-done' }}
        />
      </Match>
      <Match when={props.stage === 'write'}>
        <Button
          title="History"
          variant="ghost"
          size="sm"
          onClick={() => {
            void props.controller.manage();
          }}
          dataSet={{ testid: 'feedback-manage' }}
        />
      </Match>
    </Switch>
  );
}
