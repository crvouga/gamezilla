import { TEST_HOOKS_ENABLED } from '@libs/app-config-shared/test-hooks';
import { type JSX, Show } from 'solid-js';
import type { MultiplayerData } from './use-multiplayer-data';

/** Read-only observations of the permission-approved screen; removed from end-user bundles. */
export function MultiplayerTest(props: {
  readonly data: MultiplayerData;
}): JSX.Element {
  return (
    <Show when={TEST_HOOKS_ENABLED}>
      <pre class="sr-only" data-testid="multiplayer-state">
        {JSON.stringify({
          game: props.data.game(),
          search: props.data.search(),
          ratings: props.data.ratings(),
        })}
      </pre>
    </Show>
  );
}
