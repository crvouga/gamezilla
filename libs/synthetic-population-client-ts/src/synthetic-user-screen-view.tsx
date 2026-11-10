import {
  OBSERVATORY_PATH,
  SYNTHETIC_USERS_PATH,
} from '@libs/observatory-shared-ts/observatory-routes';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import type { Inspection } from '@libs/synthetic-population-shared-ts/inspection';
import { Trans, useLingui } from '@lingui/solid/macro';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { RefreshCwIcon } from '@pkgs/ui-root-client-ts/icons';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { ProfileScreenLayout } from '@pkgs/ui-root-client-ts/profile-screen-layout';
import type {
  ScreenBaseAction,
  ScreenBaseBreadcrumb,
} from '@pkgs/ui-root-client-ts/screen-base-types';
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
import {
  SyntheticUserDiagnostics,
  SyntheticUserStatus,
} from './synthetic-user-details';
import { SyntheticUserDom } from './synthetic-user-dom';
import {
  SyntheticUserAvatar,
  SyntheticUserIdentity,
} from './synthetic-user-identity';
import { SyntheticUserPersona } from './synthetic-user-persona';
import { SyntheticUserStatechart } from './synthetic-user-statechart';

/** One Synthetic User and its recorded events. */
export type SyntheticUserRecord = {
  readonly user: SyntheticUserDetail;
  readonly events: readonly SyntheticPopulationEventView[];
};

export type SyntheticUserScreenViewProps = {
  /**
   * The record is being read. Shown on its own on the first read; while a
   * refresh runs the header's Refresh shows it, the record staying in view.
   */
  readonly loading: boolean;
  /** The last read failed; its retry and the header's Refresh read again. */
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

type ScreenFrame = {
  readonly breadcrumbs: readonly ScreenBaseBreadcrumb[];
  readonly actions: readonly ScreenBaseAction[];
};

function ReadFailed(props: { onRetry: () => void }): JSX.Element {
  return (
    <ErrorState
      variant="compact"
      title={<Trans>Synthetic User could not be loaded.</Trans>}
      body={<Trans>Check your connection and try again.</Trans>}
      retry={{ onClick: () => props.onRetry() }}
    />
  );
}

/**
 * The control panel of the Synthetic User on screen. Mounted once per
 * Synthetic User, so a command's dialog or feedback never follows the
 * person to the next one.
 */
function SyntheticUserProfile(
  props: SyntheticUserScreenViewProps &
    ScreenFrame & { record: SyntheticUserRecord }
): JSX.Element {
  const user = () => props.record.user;
  return (
    <ProfileScreenLayout
      screenId="synthetic-user"
      breadcrumbs={props.breadcrumbs}
      actions={props.actions}
      avatar={<SyntheticUserAvatar user={user()} size={64} />}
      identity={<SyntheticUserIdentity user={user()} />}
      rail={
        <>
          <SyntheticUserStatus user={user()} />
          <SyntheticUserDiagnostics user={user()} />
        </>
      }
    >
      <Show when={props.failed}>
        <ReadFailed onRetry={props.onRefresh} />
      </Show>
      <SyntheticUserControls
        canControl={props.canControl}
        command={props.onCommand}
      />
      <SyntheticUserPersona persona={user().persona} />
      <SyntheticPopulationEventTimeline events={props.record.events} />
      {props.replay?.(user().id)}
      <SyntheticUserStatechart
        activity={user().activity}
        snapshot={props.snapshot}
      />
      <SyntheticUserDom
        snapshot={props.snapshot}
        inspect={() => props.onInspect()}
      />
    </ProfileScreenLayout>
  );
}

function SyntheticUserInspector(
  props: SyntheticUserScreenViewProps
): JSX.Element {
  const { t } = useLingui();
  const breadcrumbs = (): ScreenBaseBreadcrumb[] => [
    { name: <Trans>Profile</Trans>, href: '/profile' },
    { name: <Trans>Settings</Trans>, href: '/more' },
    { name: <Trans>User Observatory</Trans>, href: OBSERVATORY_PATH },
    { name: <Trans>Synthetic Users</Trans>, href: SYNTHETIC_USERS_PATH },
    { name: props.record?.user.username ?? t`Synthetic User` },
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
  return (
    <Show
      when={props.record?.user.id}
      keyed
      fallback={
        <ContentScreen
          screenId="synthetic-user"
          breadcrumbs={breadcrumbs()}
          actions={actions()}
        >
          <Show when={props.failed}>
            <ReadFailed onRetry={props.onRefresh} />
          </Show>
          <Show when={props.loading}>
            <LoadingState
              variant="compact"
              caption={<Trans>Reading activity…</Trans>}
            />
          </Show>
        </ContentScreen>
      }
    >
      {(_userId) => (
        <Show when={props.record}>
          {(record) => (
            <SyntheticUserProfile
              {...props}
              record={record()}
              breadcrumbs={breadcrumbs()}
              actions={actions()}
            />
          )}
        </Show>
      )}
    </Show>
  );
}

/**
 * `/admin/observatory/synthetic-users/:id`, presentational: one Synthetic
 * User's control panel. It leads with who the Synthetic User is (its face,
 * name, Bot tag, whether it is paused and what it is doing), then its
 * commands, persona, events, decision replay, behavior statechart and live
 * DOM capture; its status and diagnostics (ids, worker, lease) sit beside
 * them on a desktop and after them on a phone. Its loading, failed and
 * denied states replace the record. `SyntheticUserScreen` wires it.
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
