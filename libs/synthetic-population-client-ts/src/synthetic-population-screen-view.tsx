import {
  OBSERVATORY_PATH,
  SYNTHETIC_USERS_PATH,
} from '@libs/observatory-shared-ts/observatory-routes';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans, useLingui } from '@lingui/solid/macro';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { FormActionsFooter } from '@pkgs/ui-root-client-ts/form-actions-footer';
import { Grid } from '@pkgs/ui-root-client-ts/grid';
import { RefreshCwIcon } from '@pkgs/ui-root-client-ts/icons';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import type {
  ScreenBaseAction,
  ScreenBaseBreadcrumb,
} from '@pkgs/ui-root-client-ts/screen-base-types';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
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

/**
 * Which part of the panel a route shows: the overview (`…/synthetic-users`
 * and `…/control`) or the desired synthetic population form (`…/config`).
 */
export type SyntheticPopulationSection = 'overview' | 'configuration';

export type SyntheticPopulationScreenViewProps = {
  /** The part of the panel on screen; only `configuration` saves. */
  readonly section: SyntheticPopulationSection;
  /**
   * The overview is being read. Shown on its own on the first read; while
   * a refresh runs the header's Refresh shows it, the overview in view.
   */
  readonly loading: boolean;
  /** The last read failed; its retry and the header's Refresh read again. */
  readonly failed: boolean;
  /** The latest overview read, if any. */
  readonly overview: SyntheticPopulationOverview | undefined;
  /** Set when the person may not open this route; replaces the screen. */
  readonly denial?: DenialView | undefined;
  /** Offers the configuration form (and, on the overview, the way to it). */
  readonly canConfigure: boolean;
  /** The configuration form as typed. */
  readonly fields: ConfigurationDraft;
  /** The typed configuration is valid; otherwise save is disabled. */
  readonly canSave: boolean;
  readonly onChangeField: (field: ConfigurationField, value: string) => void;
  /** Saves the typed configuration; the footer shows its progress. */
  readonly onSave: () => Promise<void>;
  readonly onRefresh: () => void;
  /** Opens the desired synthetic population form from the overview. */
  readonly onOpenConfiguration: () => void;
  /**
   * The Synthetic User directory for an overview observed at `observedAtMs`;
   * it reads its own pages.
   */
  readonly directory?: ((observedAtMs: number) => JSX.Element) | undefined;
  /** Offers pausing and resuming every Synthetic User at once. */
  readonly canControl: boolean;
  /** Pauses or resumes every Synthetic User; its dialog shows the outcome. */
  readonly onCommandAll: (command: EveryCommand) => Promise<void>;
};

type OverviewProps = SyntheticPopulationScreenViewProps & {
  overview: SyntheticPopulationOverview;
};

/**
 * The overview: counts and controls, then the directory, beside the
 * workers and the event timeline on a desktop and before them on a phone.
 */
function OverviewSections(props: OverviewProps): JSX.Element {
  return (
    <Grid columns={{ base: 1, xl: 2 }} gap="xl" align="start">
      <StackVertical gap="xl">
        <SyntheticPopulationSummary
          overview={props.overview}
          onConfigure={
            props.canConfigure ? () => props.onOpenConfiguration() : undefined
          }
        />
        <EverySyntheticUserControls
          canControl={props.canControl}
          command={props.onCommandAll}
        />
        {props.directory?.(props.overview.observedAtMs)}
      </StackVertical>
      <StackVertical gap="xl">
        <SyntheticPopulationWorkers overview={props.overview} />
        <SyntheticPopulationEventTimeline
          events={props.overview.events.filter(
            (event) => event.event !== 'UiDriverAction'
          )}
        />
      </StackVertical>
    </Grid>
  );
}

/** The desired synthetic population form beside what is running now. */
function ConfigurationSections(props: OverviewProps): JSX.Element {
  return (
    <Grid columns={{ base: 1, xl: 2 }} gap="xl" align="start">
      <Show when={props.canConfigure}>
        <SyntheticPopulationConfiguration
          fields={props.fields}
          change={props.onChangeField}
        />
      </Show>
      <StackVertical gap="xl">
        <SyntheticPopulationSummary overview={props.overview} />
      </StackVertical>
    </Grid>
  );
}

function useScreenFrame(props: SyntheticPopulationScreenViewProps) {
  const { t } = useLingui();
  const breadcrumbs = (): ScreenBaseBreadcrumb[] => [
    { name: <Trans>Profile</Trans>, href: '/profile' },
    { name: <Trans>Settings</Trans>, href: '/more' },
    { name: <Trans>User Observatory</Trans>, href: OBSERVATORY_PATH },
    ...(props.section === 'configuration'
      ? [
          { name: <Trans>Synthetic Users</Trans>, href: SYNTHETIC_USERS_PATH },
          { name: <Trans>Desired synthetic population</Trans> },
        ]
      : [{ name: <Trans>Synthetic Users</Trans> }]),
  ];
  // Live updates reread on their own; Refresh is a quiet header action.
  const actions = (): ScreenBaseAction[] => [
    {
      type: 'secondary',
      label: t`Refresh`,
      icon: RefreshCwIcon,
      loading: props.loading,
      onClick: () => props.onRefresh(),
    },
  ];
  return { breadcrumbs, actions };
}

function SaveFooter(props: SyntheticPopulationScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <Show when={props.section === 'configuration' && props.canConfigure}>
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
  );
}

function SyntheticPopulationPanel(
  props: SyntheticPopulationScreenViewProps
): JSX.Element {
  const frame = useScreenFrame(props);
  return (
    <ContentScreen
      screenId="synthetic-population"
      breadcrumbs={frame.breadcrumbs()}
      actions={frame.actions()}
      width="list"
      footer={<SaveFooter {...props} />}
    >
      <Show when={props.loading && props.overview === undefined}>
        <LoadingState
          variant="compact"
          caption={<Trans>Reading Synthetic Population…</Trans>}
        />
      </Show>
      <Show when={props.failed}>
        <ErrorState
          variant="compact"
          title={<Trans>Synthetic Users could not be loaded.</Trans>}
          body={<Trans>Check your connection and try again.</Trans>}
          retry={{ onClick: () => props.onRefresh() }}
        />
      </Show>
      {/* Not keyed: a reread keeps open dialogs, choices and fields. */}
      <Show when={props.overview}>
        {(overview) => (
          <Show
            when={props.section === 'configuration'}
            fallback={<OverviewSections {...props} overview={overview()} />}
          >
            <ConfigurationSections {...props} overview={overview()} />
          </Show>
        )}
      </Show>
    </ContentScreen>
  );
}

/**
 * `/admin/observatory/synthetic-users` (and `…/control`), presentational:
 * the Synthetic Population panel's counts, the way to the desired synthetic
 * population, controls for every Synthetic User, the Synthetic User
 * directory, workers and event timeline. `…/config` shows the desired
 * synthetic population form with its save footer beside the counts. Both
 * have loading, failed and denied states; Refresh is a header action, since
 * the panel rereads on every live update. `SyntheticPopulationScreen` wires
 * it to the admin API.
 */
export function SyntheticPopulationScreenView(
  props: SyntheticPopulationScreenViewProps
): JSX.Element {
  return (
    <Show
      when={props.denial}
      fallback={<SyntheticPopulationPanel {...props} />}
    >
      {(denial) => <SyntheticPopulationDenial denial={denial()} />}
    </Show>
  );
}
