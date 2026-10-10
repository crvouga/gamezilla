import { DenialSurface } from '@libs/permissions-client/denial-surface';
import { Handles } from '@libs/test-ids-shared/handles';
import { Plural, Trans } from '@lingui/solid/macro';
import type { Decision } from '@pkgs/permissions-shared/decision';
import { WifiOffIcon } from '@pkgs/ui-root-client/icons';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
import { Notice } from '@pkgs/ui-root-client/notice';
import { type JSX, Match, Show, Switch } from 'solid-js';

import { useHostedSpaceCount } from './use-hosted-space-count';

/** What the last attempt to start a space came to, when it did not open one. */
export type SpacesNotice = {
  readonly kind: 'limited';
  readonly decision: Decision;
};

/** "Spaces need a connection" — said plainly, never a silent failure. */
export function SpacesNeedConnectionNotice(): JSX.Element {
  return (
    <Notice
      tone="error"
      icon={WifiOffIcon}
      dataSet={{ testid: Handles.spacesNeedConnection }}
    >
      <Trans>
        Joining someone else's space needs a connection. Your own spaces work
        offline.
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

/** A lobby has answered only once its local hosting count has hydrated. */
export function SpacesLobbyContent(props: {
  readonly class: string;
  readonly children: JSX.Element;
}): JSX.Element {
  const hosted = useHostedSpaceCount();
  return (
    <Show
      when={!hosted.isLoading()}
      fallback={
        <div class={props.class}>
          <LoadingState />
        </div>
      }
    >
      <div class={props.class} data-testid={Handles.spacesListReady}>
        <SpacesHostingCount count={hosted.count()} />
        {props.children}
      </div>
    </Show>
  );
}

/** "Hosting 2 spaces" while the viewer hosts any. */
function SpacesHostingCount(props: { readonly count: number }): JSX.Element {
  const hosted = () => props.count;
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
