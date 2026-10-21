import { Handles } from '@libs/test-ids-shared/handles';
import { Plural, Trans } from '@lingui/solid/macro';
import { WifiOffIcon } from '@pkgs/ui-root-client/icons';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
import { Notice } from '@pkgs/ui-root-client/notice';
import { type JSX, Show } from 'solid-js';

import { useHostedSpaceCount } from './use-hosted-space-count';

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

/**
 * A lobby has answered only once its local hosting count and its list of
 * spaces have both hydrated.
 */
export function SpacesLobbyContent(props: {
  readonly class: string;
  /** The lobby's list of spaces has not answered yet. */
  readonly listLoading: boolean;
  readonly children: JSX.Element;
}): JSX.Element {
  const hosted = useHostedSpaceCount();
  return (
    <Show
      when={!hosted.isLoading() && !props.listLoading}
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
