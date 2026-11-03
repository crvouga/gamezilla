/** @jsxImportSource solid-js */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@lingui/solid/macro';
import { WifiOffIcon } from '@pkgs/ui-root-client-ts/icons';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { type JSX, Match, Switch } from 'solid-js';
import type { InboxChoiceFailure } from './inbox-choice-failure';

/** What the person is told when an inbox choice did not happen. */
export function InboxChoiceFailureNotice(props: {
  readonly failure: InboxChoiceFailure;
}): JSX.Element {
  return (
    <Switch>
      <Match when={props.failure === 'connection-missing'}>
        <Notice
          tone="error"
          icon={WifiOffIcon}
          dataSet={{ testid: Handles.notificationsConnectionMissing }}
        >
          <Trans>The connection is missing.</Trans>
        </Notice>
      </Match>
      <Match when={props.failure === 'refused'}>
        <Notice
          tone="error"
          dataSet={{ testid: Handles.notificationsChoiceRefused }}
        >
          <Trans>
            That change wasn't made. The item may no longer be in your inbox.
          </Trans>
        </Notice>
      </Match>
      <Match when={props.failure === 'failed'}>
        <Notice
          tone="error"
          dataSet={{ testid: Handles.notificationsChoiceFailed }}
        >
          <Trans>That change wasn't made. Try again in a moment.</Trans>
        </Notice>
      </Match>
    </Switch>
  );
}
