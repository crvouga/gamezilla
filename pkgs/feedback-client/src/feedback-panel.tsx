/** @jsxImportSource solid-js */
import { Button } from '@pkgs/ui-client/button';
import { Match, Show, Switch } from 'solid-js';
import type { FeedbackController } from './controller';
import { FeedbackDetail } from './feedback-detail';
import { FeedbackForm } from './feedback-form';
import { FeedbackManagement } from './feedback-management';
import { useStageFocus } from './stage-focus';
import { useFeedbackState } from './use-feedback-state';

export function FeedbackPanel(props: { controller: FeedbackController }) {
  const state = useFeedbackState(() => props.controller);
  let host: HTMLDivElement | undefined;
  const workspace = () => {
    state();
    return props.controller.workspace.state();
  };
  const warning = () => {
    state();
    return props.controller.workspace.warning;
  };
  useStageFocus(
    () => host,
    () => workspace().stage
  );
  const title = () => {
    if (workspace().stage === 'manage') return 'Issues';
    if (workspace().stage === 'read') return 'Issue';
    return props.controller.editorTitle();
  };
  return (
    <div
      ref={host}
      class="box flex-1 h-full min-h-0 shrink gap-4 p-4 overflow-hidden"
      data-component="FeedbackPanel"
    >
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
        <Match when={workspace().stage === 'write'}>
          <FeedbackForm controller={props.controller} state={state} />
        </Match>
      </Switch>
    </div>
  );
}

function StageAction(props: {
  controller: FeedbackController;
  stage: 'write' | 'manage' | 'read';
}) {
  return (
    <Switch>
      <Match when={props.stage === 'manage'}>
        <Button
          title="New issue"
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
      <Match when={props.stage === 'write'}>
        <Button
          title={props.controller.editorBackLabel()}
          variant="ghost"
          size="sm"
          onClick={props.controller.editorBack}
          dataSet={{ testid: 'feedback-manage' }}
        />
      </Match>
    </Switch>
  );
}
