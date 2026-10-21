import { Trans } from '@lingui/solid/macro';
import { CodeBlock } from '@pkgs/ui-root-client/code-block';
import { EmptyState } from '@pkgs/ui-root-client/empty-state';
import { MenuRow } from '@pkgs/ui-root-client/menu-row';
import { MenuSection } from '@pkgs/ui-root-client/menu-section';
import { For, type JSX, Show } from 'solid-js';
import type { SyntheticPopulationEventView } from './synthetic-population-api';

export function SyntheticPopulationEventTimeline(props: {
  events: readonly SyntheticPopulationEventView[];
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
              <CodeBlock framed={false}>
                {JSON.stringify(event.context, null, 2)}
              </CodeBlock>
            }
          />
        )}
      </For>
      <Show when={props.events.length === 0}>
        <EmptyState
          variant="compact"
          title={<Trans>No events yet</Trans>}
          body={<Trans>Recorded activity appears here as it happens.</Trans>}
        />
      </Show>
    </MenuSection>
  );
}
