import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';
import { For, Show } from 'solid-js';
import { useRecentSpaces } from '../use-recent-spaces';
import { RecentSpaceCard } from './recent-space-card';

/** Ended spaces the actor can return to; rendered below the live lobby list. */
export function RecentSpacesSection(): JSX.Element {
  const recent = useRecentSpaces();
  return (
    <Show when={recent.spaceIds().length > 0}>
      <div class="box gap-2 pt-4">
        <p class="text textLabel text-secondary">
          <Trans>Recent spaces</Trans>
        </p>
        <div class="grid items-start gap-3">
          <For each={recent.spaceIds()}>
            {(spaceId) => <RecentSpaceCard spaceId={spaceId} />}
          </For>
        </div>
      </div>
    </Show>
  );
}
