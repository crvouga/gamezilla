import { Trans } from '@lingui/solid/macro';
import { MenuRow } from '@pkgs/ui-root-client/menu-row';
import { MenuSection } from '@pkgs/ui-root-client/menu-section';
import { For, type JSX } from 'solid-js';
import type { PopulationEventView } from './population-api';

export function PopulationEventTimeline(props: {
  events: readonly PopulationEventView[];
}): JSX.Element {
  return (
    <MenuSection title={<Trans>Event timeline</Trans>}>
      <For each={props.events}>
        {(event) => (
          <MenuRow
            title={event.event}
            caption={`${event.created_at} · ${event.correlation_id}`}
            value={event.application_version ?? ''}
            trailing={
              <pre class="text textMono overflow-auto">
                {JSON.stringify(event.context, null, 2)}
              </pre>
            }
          />
        )}
      </For>
    </MenuSection>
  );
}
