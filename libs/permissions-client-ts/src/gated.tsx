import type { AppPolicyKey } from '@libs/permissions-shared-ts/permission-catalog';
import type { Decision } from '@pkgs/permissions-shared-ts/decision';
import { createMemo, type JSX } from 'solid-js';
import { GatedView } from './gated-view';
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
 * `usePermissions().gate`). Allowed → children. Renders `GatedView`.
 */
export function Gated(props: GatedProps): JSX.Element {
  const permissions = usePermissions();
  const decision = createMemo(() => permissions.can(props.action));
  const access = createMemo(() =>
    decision().allowed ? 'allowed' : permissions.treatment(props.action)
  );
  return (
    <GatedView
      access={access()}
      action={props.action}
      onLocked={() => props.onDenied(decision())}
    >
      {props.children}
    </GatedView>
  );
}
