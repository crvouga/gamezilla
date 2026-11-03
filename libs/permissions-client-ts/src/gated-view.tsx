import type { UiTreatment } from '@pkgs/permissions-shared-ts/policy';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { type JSX, Match, Switch } from 'solid-js';

/** Whether the action is allowed, or the config treatment of its denial. */
export type GatedAccess = 'allowed' | UiTreatment;

export type GatedViewProps = {
  readonly access: GatedAccess;
  /** The policy action, as the lock button's `data-action` handle. */
  readonly action: string;
  /** A tap on the lock button; the container opens the denial surface. */
  readonly onLocked: () => void;
  readonly children: JSX.Element;
};

/**
 * Presentational half of `Gated`: `allowed` and `soft` render `children`,
 * `hide` renders nothing, `lock` renders `children` as a key-marked button
 * whose tap asks for the denial. `Gated` decides the access; the denial copy
 * itself comes from `DenialSurface` / `DenialModal`.
 */
export function GatedView(props: GatedViewProps): JSX.Element {
  return (
    <Switch fallback={props.children}>
      <Match when={props.access === 'allowed'}>{props.children}</Match>
      <Match when={props.access === 'hide'}>{null}</Match>
      <Match when={props.access === 'lock'}>
        <Button
          icon={KeyRoundIcon}
          title={props.children}
          intent="neutral"
          variant="ghost"
          onClick={() => props.onLocked()}
          dataSet={{ testid: 'permission-locked', action: props.action }}
        />
      </Match>
    </Switch>
  );
}
