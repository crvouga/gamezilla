import type { Decision } from '@pkgs/permissions';
import { Button, KeyRoundIcon } from '@pkgs/ui';
import { createMemo, type JSX, Match, Switch } from 'solid-js';

import type { AppPolicyKey } from '../shared/permission-catalog';
import { usePermissions } from './use-permissions';

export type GatedProps = {
  readonly action: AppPolicyKey;
  /** Opens the denial surface for a `lock` tap or a `soft` attempt. */
  readonly onDenied: (decision: Decision) => void;
  readonly children: JSX.Element;
};

/**
 * Renders `children` per the action's config treatment when denied:
 * `hide` renders nothing, `lock` renders a lock button that opens the denial
 * surface, `soft` renders the children (the attempt itself is gated with
 * `usePermissions().gate`). Allowed → children.
 */
export function Gated(props: GatedProps): JSX.Element {
  const permissions = usePermissions();
  const decision = createMemo(() => permissions.can(props.action));
  const treatment = createMemo(() => permissions.treatment(props.action));
  return (
    <Switch fallback={props.children}>
      <Match when={decision().allowed}>{props.children}</Match>
      <Match when={treatment() === 'hide'}>{null}</Match>
      <Match when={treatment() === 'lock'}>
        <Button
          icon={KeyRoundIcon}
          title={props.children}
          intent="neutral"
          variant="ghost"
          onClick={() => props.onDenied(decision())}
          dataSet={{ testid: 'permission-locked', action: props.action }}
        />
      </Match>
    </Switch>
  );
}
