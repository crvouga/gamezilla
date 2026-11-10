import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { FormActionsFooter } from '@pkgs/ui-root-client-ts/form-actions-footer';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { type JSX, Show } from 'solid-js';
import {
  type EveryCommand,
  EverySyntheticUserControls,
} from './every-synthetic-user-controls';
import type { SyntheticPopulationOverview } from './synthetic-population-api';
import {
  type ConfigurationDraft,
  type ConfigurationField,
  SyntheticPopulationConfiguration,
} from './synthetic-population-configuration';
import { SyntheticPopulationDenial } from './synthetic-population-denial';
import { SyntheticPopulationEventTimeline } from './synthetic-population-event-timeline';
import { SyntheticPopulationSummary } from './synthetic-population-summary';
import { SyntheticPopulationWorkers } from './synthetic-population-workers';

export type SyntheticPopulationScreenViewProps = {
  /**
   * The overview is being read. Shown on its own on the first read, and
   * above the last overview while a refresh runs.
   */
  readonly loading: boolean;
  /** The last read failed; the Refresh button is the way to try again. */
  readonly failed: boolean;
  /** The latest overview read, if any. */
  readonly overview: SyntheticPopulationOverview | undefined;
  /** Set when the person may not open this route; replaces the screen. */
  readonly denial?: DenialView | undefined;
  /** Shows the configuration form and its save footer. */
  readonly canConfigure: boolean;
  /** The configuration form as typed. */
  readonly fields: ConfigurationDraft;
  /** The typed configuration is valid; otherwise save is disabled. */
  readonly canSave: boolean;
  readonly onChangeField: (field: ConfigurationField, value: string) => void;
  /** Saves the typed configuration; the footer shows its progress. */
  readonly onSave: () => Promise<void>;
  readonly onRefresh: () => void;
  /**
   * The Synthetic User directory for an overview observed at `observedAtMs`;
   * it reads its own pages.
   */
  readonly directory?: ((observedAtMs: number) => JSX.Element) | undefined;
  /** Whoever is online now; it reads its own list. */
  readonly onlineNow?: (() => JSX.Element) | undefined;
  /** Offers pausing and resuming every Synthetic User at once. */
  readonly canControl: boolean;
  /** Pauses or resumes every Synthetic User; its dialog shows the outcome. */
  readonly onCommandAll: (command: EveryCommand) => Promise<void>;
};

function OverviewSections(
  props: Pick<
    SyntheticPopulationScreenViewProps,
    'canConfigure' | 'fields' | 'onChangeField' | 'directory'
  > & { overview: SyntheticPopulationOverview }
): JSX.Element {
  return (
    <>
      <SyntheticPopulationSummary overview={props.overview} />
      <Show when={props.canConfigure}>
        <SyntheticPopulationConfiguration
          fields={props.fields}
          change={props.onChangeField}
        />
      </Show>
      {props.directory?.(props.overview.observedAtMs)}
      <SyntheticPopulationWorkers overview={props.overview} />
      <SyntheticPopulationEventTimeline
        events={props.overview.events.filter(
          (event) => event.event !== 'UiDriverAction'
        )}
      />
    </>
  );
}

function SyntheticPopulationOverviewScreen(
  props: SyntheticPopulationScreenViewProps
): JSX.Element {
  const { t } = useLingui();
  return (
    <ContentScreen
      screenId="synthetic-population"
      breadcrumbs={[
        { name: <Trans>Profile</Trans>, href: '/profile' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>Bot Observatory</Trans> },
      ]}
      footer={
        <Show when={props.canConfigure}>
          <FormActionsFooter
            submit={{
              label: t`Save synthetic population`,
              loadingLabel: t`Saving…`,
              successLabel: t`Saved`,
              operation: () => props.onSave(),
              get disabled() {
                return !props.canSave;
              },
              dataSet: { testid: 'synthetic-population-save' },
            }}
          />
        </Show>
      }
    >
      <Show when={props.loading}>
        <LoadingState
          variant="compact"
          caption={<Trans>Reading Synthetic Population…</Trans>}
        />
      </Show>
      <Show when={props.failed}>
        <ErrorState
          variant="compact"
          title={<Trans>Bot Observatory could not be loaded.</Trans>}
          body={<Trans>Refresh to try again.</Trans>}
        />
      </Show>
      <Button title={t`Refresh`} onClick={() => props.onRefresh()} />
      {/* Outside the overview: a reread keeps their dialogs and choices. */}
      <Show when={props.overview !== undefined}>
        <EverySyntheticUserControls
          canControl={props.canControl}
          command={props.onCommandAll}
        />
        {props.onlineNow?.()}
      </Show>
      <Show when={props.overview} keyed>
        {(overview) => (
          <OverviewSections
            overview={overview}
            canConfigure={props.canConfigure}
            fields={props.fields}
            onChangeField={props.onChangeField}
            directory={props.directory}
          />
        )}
      </Show>
    </ContentScreen>
  );
}

/**
 * `/admin/synthetic-population`, `/admin/synthetic-population/config` and
 * `/admin/synthetic-population/control`, presentational: the Bot
 * Observatory's summary, controls for every Synthetic User, whoever is online
 * now, configuration form, Synthetic User directory, workers and event
 * timeline, with its loading, failed and denied states.
 * `SyntheticPopulationScreen` wires it to the admin API.
 */
export function SyntheticPopulationScreenView(
  props: SyntheticPopulationScreenViewProps
): JSX.Element {
  return (
    <Show
      when={props.denial}
      fallback={<SyntheticPopulationOverviewScreen {...props} />}
    >
      {(denial) => <SyntheticPopulationDenial denial={denial()} />}
    </Show>
  );
}
