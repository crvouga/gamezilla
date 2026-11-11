import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import type { Inspection } from '@libs/synthetic-population-shared-ts/inspection';
import { Trans, useLingui } from '@lingui/solid/macro';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import {
  CodeIcon,
  HistoryIcon,
  RotateCcwIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { ProfileScreenLayout } from '@pkgs/ui-root-client-ts/profile-screen-layout';
import type {
  ScreenBaseAction,
  ScreenBaseBreadcrumb,
} from '@pkgs/ui-root-client-ts/screen-base-types';
import { type JSX, Show } from 'solid-js';
import type { SyntheticUserDetail } from './synthetic-population-api';
import { SyntheticPopulationDenial } from './synthetic-population-denial';
import { panelCrumbs, useRefreshAction } from './synthetic-population-frame';
import {
  type SyntheticUserCommand,
  SyntheticUserControls,
} from './synthetic-user-controls';
import {
  SyntheticUserDiagnostics,
  SyntheticUserStatus,
} from './synthetic-user-details';
import {
  SyntheticUserAvatar,
  SyntheticUserIdentity,
} from './synthetic-user-identity';
import { SyntheticUserPersona } from './synthetic-user-persona';
import { SyntheticUserStatechart } from './synthetic-user-statechart';

/** Where a control panel leads: each a surface of its own. */
export type SyntheticUserDestination = 'events' | 'replay' | 'inspector';

export type SyntheticUserScreenViewProps = {
  /**
   * The Synthetic User is being read. Shown on its own on the first read;
   * while a refresh runs the header's Refresh shows it.
   */
  readonly loading: boolean;
  /** The last read failed; its retry and the header's Refresh read again. */
  readonly failed: boolean;
  /** The Synthetic User last read, if any. */
  readonly user: SyntheticUserDetail | undefined;
  /** The live DOM capture for the user's current generation, if any. */
  readonly snapshot: Inspection | null;
  /** Set when the person may not inspect Synthetic Users; replaces the screen. */
  readonly denial?: DenialView | undefined;
  /** Shows pause, resume and restart. */
  readonly canControl: boolean;
  /** Offers decision replay. */
  readonly canReplay: boolean;
  readonly onRefresh: () => void;
  /** Sends a control command once confirmed; its dialog shows the outcome. */
  readonly onCommand: (command: SyntheticUserCommand) => Promise<void>;
  readonly onOpen: (destination: SyntheticUserDestination) => void;
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

/** The ways on from a control panel: its records, each on its own screen. */
function SyntheticUserRecords(
  props: Pick<SyntheticUserScreenViewProps, 'canReplay' | 'onOpen'>
): JSX.Element {
  const { t } = useLingui();
  return (
    <MenuSection title={<Trans>Records</Trans>}>
      <MenuRow
        leading={<HistoryIcon size={20} color="icon" />}
        title={t`Event timeline`}
        caption={t`What this Synthetic User recorded, newest first`}
        onClick={() => props.onOpen('events')}
        dataSet={{ testid: 'synthetic-user-open-events' }}
      />
      <Show when={props.canReplay}>
        <MenuRow
          leading={<RotateCcwIcon size={20} color="icon" />}
          title={t`Decision replay`}
          caption={t`Whether the current Decision Policy makes its recorded choices`}
          onClick={() => props.onOpen('replay')}
          dataSet={{ testid: 'synthetic-user-open-replay' }}
        />
      </Show>
      <MenuRow
        leading={<CodeIcon size={20} color="icon" />}
        title={t`UI inspector`}
        caption={t`A sanitized capture of its app's live screen`}
        onClick={() => props.onOpen('inspector')}
        dataSet={{ testid: 'synthetic-user-open-inspector' }}
      />
    </MenuSection>
  );
}

/**
 * The control panel of the Synthetic User on screen. Mounted once per
 * Synthetic User, so a command's dialog or feedback never follows the
 * person to the next one.
 */
function SyntheticUserProfile(
  props: SyntheticUserScreenViewProps &
    ScreenFrame & { user: SyntheticUserDetail }
): JSX.Element {
  return (
    <ProfileScreenLayout
      screenId="synthetic-user"
      breadcrumbs={props.breadcrumbs}
      actions={props.actions}
      avatar={<SyntheticUserAvatar user={props.user} size={64} />}
      identity={<SyntheticUserIdentity user={props.user} />}
      rail={
        <>
          <SyntheticUserStatus user={props.user} />
          <SyntheticUserDiagnostics user={props.user} />
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
      <SyntheticUserPersona persona={props.user.persona} />
      <SyntheticUserRecords canReplay={props.canReplay} onOpen={props.onOpen} />
      <SyntheticUserStatechart
        activity={props.user.activity}
        snapshot={props.snapshot}
      />
    </ProfileScreenLayout>
  );
}

function SyntheticUserInspector(
  props: SyntheticUserScreenViewProps
): JSX.Element {
  // The identity header names the Synthetic User; the trail names the screen.
  const breadcrumbs = (): ScreenBaseBreadcrumb[] =>
    panelCrumbs([{ name: <Trans>Control panel</Trans> }]);
  const actions = useRefreshAction(props);
  return (
    <Show
      when={props.user?.id}
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
              caption={<Trans>Reading Synthetic User…</Trans>}
            />
          </Show>
        </ContentScreen>
      }
    >
      {(_userId) => (
        <Show when={props.user}>
          {(user) => (
            <SyntheticUserProfile
              {...props}
              user={user()}
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
 * name, Bot tag, whether it is paused and what it is doing), then pause,
 * resume and restart (each confirmed in a dialog that reports its
 * outcome), its persona, the ways to its event timeline, decision replay
 * and UI inspector (each a screen of its own) and its behavior statechart;
 * its status and diagnostics sit beside them on a desktop and after them
 * on a phone. Its loading, failed and denied states replace it.
 * `SyntheticUserScreen` wires it.
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
