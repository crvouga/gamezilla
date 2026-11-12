/** @jsxImportSource solid-js */

import { MAX_DESCRIPTION_LENGTH } from '@pkgs/feedback-shared-ts/bug-report';
import { asLocalized } from '@pkgs/i18n-shared-ts/localized-string';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { FileTrigger } from '@pkgs/ui-root-client-ts/file-trigger';
import { Form } from '@pkgs/ui-root-client-ts/form';
import { IconButton } from '@pkgs/ui-root-client-ts/icon-button';
import { PlusIcon, SendIcon, XIcon } from '@pkgs/ui-root-client-ts/icons';
import { Image } from '@pkgs/ui-root-client-ts/image';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { Textarea } from '@pkgs/ui-root-client-ts/textarea';
import { For, Match, Show, Switch } from 'solid-js';
import type { BugReportState, ChosenPicture } from './controller';
import {
  type BugReportNotice,
  DEBUG_INFO_NOTE,
  noticeText,
  waitingText,
} from './copy';

export type BugReportFormViewProps = {
  description: string;
  screenshots: BugReportState['screenshots'];
  /** Pictures chosen and still being saved. */
  adding: number;
  phase: BugReportState['phase'];
  notice: BugReportNotice | null;
  /** Bug reports kept on the device until they can be sent. */
  waiting: number;
  onDescribe: (description: string) => void;
  onAddPicture: (picture: ChosenPicture) => void;
  onRemoveScreenshot: (id: string) => void;
  onSend: () => void;
  onClose: () => void;
};

function chosen(file: File): ChosenPicture {
  return {
    contentType: file.type,
    size: file.size,
    read: async () => new Uint8Array(await file.arrayBuffer()),
  };
}

function Screenshots(props: BugReportFormViewProps) {
  const busy = () => props.phase === 'sending';
  return (
    <StackVertical gap="xs">
      <StackHorizontal
        wrap
        align="center"
        gap="sm"
        testId="bug-report-screenshots"
      >
        <For each={props.screenshots}>
          {(screenshot, index) => (
            <StackHorizontal
              align="start"
              gap="none"
              testId="bug-report-screenshot"
            >
              <Image
                src={screenshot.url ?? ''}
                alt={`Screenshot ${index() + 1}`}
                ratio="square"
                fit="cover"
                radius="control"
                size="sm"
              />
              <IconButton
                label={`Remove screenshot ${index() + 1}`}
                tooltip="none"
                size={32}
                disabled={busy()}
                onClick={() => props.onRemoveScreenshot(screenshot.id)}
                dataSet={{ testid: 'bug-report-remove-screenshot' }}
              >
                <XIcon size={16} />
              </IconButton>
            </StackHorizontal>
          )}
        </For>
        <FileTrigger
          label="Add a picture"
          accept="image/png,image/jpeg,image/webp"
          onSelect={(file) => props.onAddPicture(chosen(file))}
          testId="bug-report-picture"
        >
          {(open) => (
            <Button
              title="Add picture"
              icon={PlusIcon}
              variant="outline"
              size="sm"
              disabled={busy()}
              loading={props.adding > 0}
              onClick={open}
              dataSet={{ testid: 'bug-report-add-picture' }}
            />
          )}
        </FileTrigger>
      </StackHorizontal>
      <Show when={props.screenshots.length === 0 && props.adding === 0}>
        <P variant="caption" tone="secondary">
          No screenshot will be sent.
        </P>
      </Show>
    </StackVertical>
  );
}

function Draft(props: BugReportFormViewProps) {
  return (
    <Form
      gap="md"
      aria-label="Report a bug"
      testId="bug-report-form"
      onSubmit={() => props.onSend()}
    >
      <Textarea
        rows={5}
        autoGrow
        maxLength={MAX_DESCRIPTION_LENGTH}
        aria-label={asLocalized('What happened?')}
        placeholder={asLocalized(
          'What happened, and what did you expect instead?'
        )}
        value={props.description}
        onValueChange={(description) => props.onDescribe(description)}
        disabled={props.phase === 'sending'}
        invalid={props.notice === 'describe'}
        testId="bug-report-description"
      />
      <Screenshots {...props} />
      <Show when={props.notice}>
        {(notice) => (
          <Notice tone="error" dataSet={{ testid: 'bug-report-notice' }}>
            {noticeText(notice())}
          </Notice>
        )}
      </Show>
      <Show when={props.waiting > 0}>
        <Notice tone="info" dataSet={{ testid: 'bug-report-waiting' }}>
          {waitingText(props.waiting)}
        </Notice>
      </Show>
      <Notice dataSet={{ testid: 'bug-report-debug-info' }}>
        {DEBUG_INFO_NOTE}
      </Notice>
      <Button
        title="Send bug report"
        loadingLabel="Sending…"
        icon={SendIcon}
        type="submit"
        fullWidth
        loading={props.phase === 'sending'}
        dataSet={{ testid: 'bug-report-send' }}
      />
    </Form>
  );
}

function Done(props: BugReportFormViewProps) {
  return (
    <StackVertical gap="md" testId="bug-report-done">
      <Show when={props.notice}>
        {(notice) => (
          <Notice
            tone={notice() === 'sent' ? 'success' : 'info'}
            dataSet={{ testid: 'bug-report-notice' }}
          >
            {noticeText(notice())}
          </Notice>
        )}
      </Show>
      <Button
        title="Done"
        fullWidth
        onClick={() => props.onClose()}
        dataSet={{ testid: 'bug-report-done-close' }}
      />
    </StackVertical>
  );
}

/**
 * The whole bug report: say what happened, see which screenshots go with
 * it, and send. Nothing else is asked of a person who just hit a bug.
 */
export function BugReportFormView(props: BugReportFormViewProps) {
  return (
    <Switch>
      <Match when={props.phase === 'done'}>
        <Done {...props} />
      </Match>
      <Match when={props.phase !== 'done'}>
        <Draft {...props} />
      </Match>
    </Switch>
  );
}
