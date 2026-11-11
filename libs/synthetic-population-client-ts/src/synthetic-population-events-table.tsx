import { Trans, useLingui } from '@lingui/solid/macro';
import { CodeBlock } from '@pkgs/ui-root-client-ts/code-block';
import { DataTable } from '@pkgs/ui-root-client-ts/data-table';
import {
  ModalBody,
  ModalButton,
  ModalFooter,
} from '@pkgs/ui-root-client-ts/modal-parts';
import { ResponsiveSurface } from '@pkgs/ui-root-client-ts/responsive-surface';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { TableColumn } from '@pkgs/ui-root-client-ts/table';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createSignal, type JSX, Show } from 'solid-js';
import type { SyntheticPopulationEventView } from './synthetic-population-api';
import { useMomentLabel } from './synthetic-user-labels';

export type SyntheticPopulationEventsTableProps = {
  /** The events last read, as recorded; `undefined` before the first read. */
  readonly events: readonly SyntheticPopulationEventView[] | undefined;
  readonly loading: boolean;
  readonly failed: boolean;
  readonly onRetry: () => void;
};

/** One event's correlation and context, read-only, over the table. */
function EventDetail(props: {
  event: SyntheticPopulationEventView | null;
  onClose: () => void;
}): JSX.Element {
  const { t } = useLingui();
  const moment = useMomentLabel();
  return (
    <ResponsiveSurface
      visible={props.event !== null}
      onClose={() => props.onClose()}
      title={props.event?.event}
      presentation="modal"
      size="large"
    >
      <Show when={props.event} keyed>
        {(event) => {
          const correlation = event.correlation_id;
          const at = moment(event.created_at);
          return (
            <ModalBody>
              <StackVertical gap="sm">
                <P variant="caption">{t`Recorded ${at}`}</P>
                <P variant="caption">{t`Correlation ${correlation}`}</P>
                <CodeBlock wrap testId="synthetic-population-event-context">
                  {JSON.stringify(event.context, null, 2)}
                </CodeBlock>
              </StackVertical>
            </ModalBody>
          );
        }}
      </Show>
      <ModalFooter>
        <ModalButton
          label={<Trans>Close</Trans>}
          onClick={() => props.onClose()}
        />
      </ModalFooter>
    </ResponsiveSurface>
  );
}

function useEventColumns(): () => readonly TableColumn<SyntheticPopulationEventView>[] {
  const { t } = useLingui();
  const moment = useMomentLabel();
  return () => [
    {
      key: 'event',
      header: t`Event`,
      primary: true,
      sortValue: (event) => event.event,
      render: (event) => <P variant="rowTitle">{event.event}</P>,
    },
    {
      key: 'when',
      header: t`When`,
      sortValue: (event) => Date.parse(event.created_at),
      render: (event) => moment(event.created_at),
    },
    {
      key: 'version',
      header: t`Version`,
      width: 'min',
      sortValue: (event) => event.application_version ?? '',
      render: (event) => event.application_version ?? t`Unknown`,
    },
  ];
}

/**
 * Recorded Synthetic Population events as a table, newest first, with a
 * search over their names; a row opens its correlation and context
 * read-only. Shared by the population's events and one Synthetic User's.
 */
export function SyntheticPopulationEventsTable(
  props: SyntheticPopulationEventsTableProps
): JSX.Element {
  const { t } = useLingui();
  const columns = useEventColumns();
  const [search, setSearch] = createSignal('');
  const [open, setOpen] = createSignal<SyntheticPopulationEventView | null>(
    null
  );
  const rows = () => {
    const term = search().trim().toLowerCase();
    return props.events?.filter((event) =>
      `${event.event} ${event.correlation_id}`.toLowerCase().includes(term)
    );
  };
  const count = () => {
    const total = String(rows()?.length ?? 0);
    return rows() === undefined ? undefined : t`${total} events`;
  };
  return (
    <>
      <DataTable
        caption={t`Event timeline`}
        count={count()}
        columns={columns()}
        rows={rows()}
        rowKey={(event) => event.id}
        onRowPress={(event) => setOpen(event)}
        rowLabel={(event) => {
          const name = event.event;
          return t`Open ${name}`;
        }}
        defaultSort={{ key: 'when', direction: 'descending' }}
        search={{
          value: search(),
          onChange: setSearch,
          label: t`Find events`,
          placeholder: t`Event name or correlation`,
        }}
        loading={props.loading}
        loadingLabel={t`Reading events…`}
        failure={
          props.failed
            ? {
                title: t`Events could not be loaded.`,
                body: t`Check your connection and try again.`,
                onRetry: () => props.onRetry(),
              }
            : undefined
        }
        empty={{
          title: t`No events yet`,
          body: t`Recorded activity appears here as it happens.`,
        }}
        testId="synthetic-population-event"
      />
      <EventDetail event={open()} onClose={() => setOpen(null)} />
    </>
  );
}
