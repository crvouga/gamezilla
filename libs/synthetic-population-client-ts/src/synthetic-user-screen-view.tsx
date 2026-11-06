import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import type { Inspection } from '@libs/synthetic-population-shared-ts/inspection';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { type JSX, Show } from 'solid-js';
import type {
  SyntheticPopulationEventView,
  SyntheticUserDetail,
} from './synthetic-population-api';
import { SyntheticPopulationDenial } from './synthetic-population-denial';
import { SyntheticPopulationEventTimeline } from './synthetic-population-event-timeline';
import {
  type SyntheticUserCommand,
  SyntheticUserControls,
} from './synthetic-user-controls';
import { SyntheticUserDetails } from './synthetic-user-details';
import { SyntheticUserDom } from './synthetic-user-dom';
import { SyntheticUserStatechart } from './synthetic-user-statechart';

/** One Synthetic User and its recorded events. */
export type SyntheticUserRecord = {
  readonly user: SyntheticUserDetail;
  readonly events: readonly SyntheticPopulationEventView[];
};

export type SyntheticUserScreenViewProps = {
  /**
   * The record is being read. Shown on its own on the first read, and above
   * the last record while a refresh runs.
   */
  readonly loading: boolean;
  /** The last read failed; the Refresh button is the way to try again. */
  readonly failed: boolean;
  /** The latest record read, if any. */
  readonly record: SyntheticUserRecord | undefined;
  /** The live DOM capture for the user's current generation, if any. */
  readonly snapshot: Inspection | null;
  /** Set when the person may not inspect Synthetic Users; replaces the screen. */
  readonly denial?: DenialView | undefined;
  /** Shows pause, resume and restart. */
  readonly canControl: boolean;
  readonly onRefresh: () => void;
  /** Sends a control command; its button shows the outcome. */
  readonly onCommand: (command: SyntheticUserCommand) => Promise<void>;
  /** Requests a live DOM capture; its button shows the outcome. */
  readonly onInspect: () => Promise<void>;
  /** Decision Policy replay for the user; it runs its own replays. */
  readonly replay?: ((userId: string) => JSX.Element) | undefined;
};

function SyntheticUserSections(
  props: SyntheticUserScreenViewProps & { record: SyntheticUserRecord }
): JSX.Element {
  return (
    <>
      <SyntheticUserDetails user={props.record.user} />
      <SyntheticUserControls
        canControl={props.canControl}
        command={props.onCommand}
      />
      <SyntheticUserStatechart
        activity={props.record.user.activity}
        snapshot={props.snapshot}
      />
      <SyntheticPopulationEventTimeline events={props.record.events} />
      {props.replay?.(props.record.user.id)}
      <SyntheticUserDom
        snapshot={props.snapshot}
        inspect={() => props.onInspect()}
      />
    </>
  );
}

function SyntheticUserInspector(
  props: SyntheticUserScreenViewProps
): JSX.Element {
  const { t } = useLingui();
  return (
    <ContentScreen
      screenId="synthetic-user"
      breadcrumbs={[
        { name: <Trans>Profile</Trans>, href: '/profile' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        {
          name: <Trans>Bot Observatory</Trans>,
          href: '/admin/synthetic-population',
        },
        { name: <Trans>Synthetic User</Trans> },
      ]}
    >
      <Show when={props.failed}>
        <ErrorState
          variant="compact"
          title={<Trans>Synthetic User could not be loaded.</Trans>}
          body={<Trans>Refresh to try again.</Trans>}
        />
      </Show>
      <Show when={props.loading}>
        <LoadingState
          variant="compact"
          caption={<Trans>Reading activity…</Trans>}
        />
      </Show>
      <Button title={t`Refresh`} onClick={() => props.onRefresh()} />
      <Show when={props.record}>
        {(record) => <SyntheticUserSections {...props} record={record()} />}
      </Show>
    </ContentScreen>
  );
}

/**
 * `/admin/synthetic-population/users/:id`, presentational: one Synthetic
 * User's details, controls, behavior statechart, events, decision replay and
 * live DOM capture, with its loading, failed and denied states.
 * `SyntheticUserScreen` wires it to the admin API.
 */
export function SyntheticUserScreenView(
  props: SyntheticUserScreenViewProps
): JSX.Element {
  return (
    <Show when={props.denial} fallback={<SyntheticUserInspector {...props} />}>
      {(denial) => <SyntheticPopulationDenial denial={denial()} />}
    </Show>
  );
}
