import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import type { Inspection } from '@libs/synthetic-population-shared-ts/inspection';
import { Trans } from '@lingui/solid/macro';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { type JSX, Show } from 'solid-js';
import { SyntheticPopulationDenial } from './synthetic-population-denial';
import {
  syntheticUserCrumbs,
  useRefreshAction,
} from './synthetic-population-frame';
import { SyntheticUserDom } from './synthetic-user-dom';
import type { SyntheticUserName } from './synthetic-user-events-screen-view';

export type SyntheticUserInspectorScreenViewProps = {
  /** Set when the person may not inspect Synthetic Users; replaces the screen. */
  readonly denial?: DenialView | undefined;
  /** Whose app, once read; names the way back to its control panel. */
  readonly user: SyntheticUserName | undefined;
  /** The live DOM capture for its current session, if one is current. */
  readonly snapshot: Inspection | null;
  readonly loading: boolean;
  /** The last read failed; its retry reads again. */
  readonly failed: boolean;
  readonly onRefresh: () => void;
  /** Requests a new capture; its button shows the outcome. */
  readonly onInspect: () => Promise<void>;
};

function InspectorScreen(
  props: SyntheticUserInspectorScreenViewProps
): JSX.Element {
  const refresh = useRefreshAction(props);
  return (
    <ContentScreen
      screenId="synthetic-user-inspector"
      breadcrumbs={syntheticUserCrumbs(props.user, {
        name: <Trans>UI inspector</Trans>,
      })}
      actions={refresh()}
      width="list"
    >
      <StackVertical gap="xl">
        <Show when={props.failed}>
          <ErrorState
            variant="compact"
            title={<Trans>Synthetic User could not be loaded.</Trans>}
            body={<Trans>Check your connection and try again.</Trans>}
            retry={{ onClick: () => props.onRefresh() }}
          />
        </Show>
        <SyntheticUserDom
          snapshot={props.snapshot}
          inspect={() => props.onInspect()}
        />
      </StackVertical>
    </ContentScreen>
  );
}

/**
 * `/admin/observatory/synthetic-users/:id/inspector`, presentational: one
 * Synthetic User's in-process UI inspector — a request for a live DOM
 * capture and, once one is current, its route, controls, recent actions
 * and sanitized markup. A failed read offers a retry; its denied state
 * replaces it. `SyntheticUserInspectorScreen` wires it.
 */
export function SyntheticUserInspectorScreenView(
  props: SyntheticUserInspectorScreenViewProps
): JSX.Element {
  return (
    <Show when={props.denial} fallback={<InspectorScreen {...props} />}>
      {(denial) => <SyntheticPopulationDenial denial={denial()} />}
    </Show>
  );
}
