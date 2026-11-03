import type { Decision } from '@pkgs/permissions-shared-ts/decision';
import type { IconComponent } from '@pkgs/ui-root-client-ts/create-icon';
import { type JSX, Show } from 'solid-js';
import { useDenialView } from './denial-surface';
import type { DenialView } from './denial-surface-view';

export type DecisionGateProps = {
  readonly decision: Decision;
  /** The denial's glyph; defaults to a clock (quota) or a key. */
  readonly icon?: IconComponent | undefined;
  /** `data-testid` for the denial; its CTA is `<testId>-action`. */
  readonly testId?: string | undefined;
  /** The screen view in its denied state, given the resolved denial. */
  readonly denied: (denial: DenialView) => JSX.Element;
  /** The smart screen, mounted only while the decision allows it. */
  readonly children: JSX.Element;
};

function DeniedScreen(props: Omit<DecisionGateProps, 'children'>) {
  const denial = useDenialView(props);
  return <>{props.denied(denial())}</>;
}

/**
 * Container-side permission gate: mounts `children` (and their queries) only
 * when allowed; otherwise resolves the denial and hands it to the screen's
 * presentational view, so the denied state is a plain-data story.
 *
 * Use it in a screen's container, never in its view: the view takes
 * `denial?: DenialView` and renders `DenialSurfaceView`. For a refusal that
 * should not replace the screen (a tapped action), use `DenialModal` instead.
 *
 * @example
 * ```tsx
 * <DecisionGate
 *   decision={decision()}
 *   denied={(denial) => <FriendsListScreenView denial={denial} … />}
 * >
 *   <FriendsListContainer />
 * </DecisionGate>
 * ```
 */
export function DecisionGate(props: DecisionGateProps): JSX.Element {
  return (
    <Show
      when={props.decision.allowed}
      fallback={
        <DeniedScreen
          decision={props.decision}
          icon={props.icon}
          testId={props.testId}
          denied={props.denied}
        />
      }
    >
      {props.children}
    </Show>
  );
}
