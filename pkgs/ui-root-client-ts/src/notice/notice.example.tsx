/** @jsxImportSource solid-js */

import { ActionNotice } from '@pkgs/ui-root-client-ts/action-notice';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

export default function NoticeExample(): JSX.Element {
  return (
    <ExampleRoot>
      <SchemePreview>
        <Notice>{'Changes apply the next time you sign in.'}</Notice>
        <Notice tone="info">{'Rated games count toward your rating.'}</Notice>
        <Notice tone="success">{'Your username is available.'}</Notice>
        <Notice tone="warning">
          {'You are offline. Moves sync when you reconnect.'}
        </Notice>
        <Notice tone="warning" onDismiss={() => undefined}>
          {"Your space wasn't renamed. That space name is not allowed."}
        </Notice>
        <Notice tone="error">
          {"Couldn't find an account with that email."}
        </Notice>
        <ActionNotice
          title="Puzzles are empty"
          body="Import a collection to start practicing."
          action={{ label: 'Import', onClick: () => undefined }}
        />
      </SchemePreview>
    </ExampleRoot>
  );
}
