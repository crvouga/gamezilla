/** @jsxImportSource solid-js */
import { Button } from '@pkgs/ui-root-client-ts/button';
import { H2 } from '@pkgs/ui-root-client-ts/heading';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { createUniqueId, Match, Show, Switch } from 'solid-js';
import type { FeedbackController } from './controller';
import { FeedbackDetail } from './feedback-detail';
import { FeedbackForm } from './feedback-form';
import { FeedbackManagement } from './feedback-management';
import { useStageFocus } from './stage-focus';
import { useFeedbackState } from './use-feedback-state';

export function FeedbackPanel(props: { controller: FeedbackController }) {
  const state = useFeedbackState(() => props.controller);
  const hostId = createUniqueId();
  const workspace = () => {
    state();
    return props.controller.workspace.state();
  };
  const warning = () => {
    state();
    return props.controller.workspace.warning;
  };
  useStageFocus(
    () => document.getElementById(hostId) ?? undefined,
    () => workspace().stage
  );
  const title = () => {
    if (workspace().stage === 'manage') return 'Issues';
    if (workspace().stage === 'read') return 'Issue';
    return props.controller.editorTitle();
  };
  return (
    <StackVertical
      id={hostId}
      grow
      shrink
      height="full"
      gap="lg"
      padding="lg"
      overflow="hidden"
      testId="feedback-panel"
    >
      <StackHorizontal align="center" justify="between" gap="md">
        <H2 size="subtitle" lines={1}>
          {title()}
        </H2>
        <StageAction controller={props.controller} stage={workspace().stage} />
      </StackHorizontal>
      <Show when={warning()}>
        {(message) => (
          <Notice tone="error">
            <StackVertical gap="sm" align="start">
              <Text variant="inherit">{message()}</Text>
              <Button
                title="Try saving again"
                variant="outline"
                size="sm"
                onClick={() => {
                  props.controller.workspace.retrySave();
                  props.controller.setStage(workspace().stage);
                }}
              />
            </StackVertical>
          </Notice>
        )}
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
    </StackVertical>
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
