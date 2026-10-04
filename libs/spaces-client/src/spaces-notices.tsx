import { DenialSurface } from '@libs/permissions-client/denial-surface';
import type { Decision } from '@pkgs/permissions-shared/decision';
import { Handles } from '@libs/test-ids-shared/handles';
import { Plural, Trans } from '@lingui/solid/macro';
import { Notice } from '@pkgs/ui-client/notice';
import { WifiOffIcon } from '@pkgs/ui-client/icons';
import { type JSX, Match, Show, Switch } from 'solid-js';

import { useHostedSpaceCount } from './use-hosted-space-count';

/** What the last attempt to start a space came to, when it did not open one. */
export type SpacesNotice =
  | { readonly kind: 'offline' }
  | { readonly kind: 'limited'; readonly decision: Decision };

/** "Spaces need a connection" — said plainly, never a silent failure. */
export function SpacesNeedConnectionNotice(): JSX.Element {
  return (
    <Notice
      tone="error"
      icon={WifiOffIcon}
      dataSet={{ testid: Handles.spacesNeedConnection }}
    >
      <Trans>
        Spaces need a connection. Connect to the internet and try again.
      </Trans>
    </Notice>
  );
}

/** The outcome of starting a space that did not open one. */
export function SpacesAttemptNotice(props: {
  readonly notice: SpacesNotice | null;
}): JSX.Element {
  return (
    <Switch>
      <Match when={props.notice?.kind === 'offline'}>
        <SpacesNeedConnectionNotice />
      </Match>
      <Match
        when={(() => {
          const n = props.notice;
          return n?.kind === 'limited' ? n.decision : undefined;
        })()}
      >
        {(decision) => (
          <DenialSurface
            decision={decision()}
            variant="compact"
            testId={Handles.spacesHostingLimit}
          />
        )}
      </Match>
    </Switch>
  );
}

/** "Hosting 2 spaces" while the viewer hosts any. */
export function SpacesHostingCount(): JSX.Element {
  const hosted = useHostedSpaceCount();
  return (
    <Show when={hosted() > 0}>
      <p
        class="text textCaption text-text-secondary"
        data-testid={Handles.spacesHostingCount}
        data-count={String(hosted())}
      >
        <Plural
          value={hosted()}
          one="Hosting # space"
          other="Hosting # spaces"
        />
      </p>
    </Show>
  );
}
