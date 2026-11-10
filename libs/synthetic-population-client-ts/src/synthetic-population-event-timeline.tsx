import { Trans, useLingui } from '@lingui/solid/macro';
import { CodeBlock } from '@pkgs/ui-root-client-ts/code-block';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createSignal, For, type JSX, Show } from 'solid-js';
import type { SyntheticPopulationEventView } from './synthetic-population-api';
import { useMomentLabel } from './synthetic-user-labels';

/**
 * One recorded event: its name, when it happened and the version that
 * recorded it; opening it shows its correlation and context.
 */
function EventRow(props: { event: SyntheticPopulationEventView }): JSX.Element {
  const { t } = useLingui();
  const moment = useMomentLabel();
  const [open, setOpen] = createSignal(false);
  const correlation = () => {
    const id = props.event.correlation_id;
    return t`Correlation ${id}`;
  };
  return (
    <>
      <MenuRow
        title={props.event.event}
        caption={moment(props.event.created_at)}
        value={props.event.application_version ?? undefined}
        expanded={open()}
        onClick={() => setOpen((value) => !value)}
      />
      <Show when={open()}>
        <StackVertical paddingX="lg" paddingBottom="lg" gap="sm">
          <P variant="caption">{correlation()}</P>
          <CodeBlock wrap>
            {JSON.stringify(props.event.context, null, 2)}
          </CodeBlock>
        </StackVertical>
      </Show>
    </>
  );
}

/**
 * Recorded Synthetic Population events, newest as recorded, each opening to
 * its context; an empty timeline says what will appear.
 */
export function SyntheticPopulationEventTimeline(props: {
  events: readonly SyntheticPopulationEventView[];
}): JSX.Element {
  const { t } = useLingui();
  return (
    <MenuSection title={<Trans>Event timeline</Trans>}>
      <For each={props.events}>{(event) => <EventRow event={event} />}</For>
      <Show when={props.events.length === 0}>
        <EmptyState
          variant="compact"
          title={t`No events yet`}
          body={t`Recorded activity appears here as it happens.`}
        />
      </Show>
    </MenuSection>
  );
}
