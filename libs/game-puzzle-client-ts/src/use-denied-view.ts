import { useDenialView } from '@libs/permissions-client-ts/denial-surface';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import type { Decision } from '@pkgs/permissions-shared-ts/decision';
import type { IconComponent } from '@pkgs/ui-root-client-ts/create-icon';
import type { Accessor } from 'solid-js';

/** Stands in while there is nothing denied: it resolves to no copy or CTA. */
const NOT_DENIED: Decision = { allowed: true, policyVersion: '' };

/**
 * A decision resolved to the plain data a screen view's denied state takes,
 * or undefined while it allows (or there is none). Keeps the view mounted
 * when the decision flips, unlike a gate.
 */
export function useDeniedView(props: {
  readonly decision: Decision | null;
  readonly icon?: IconComponent | undefined;
  readonly testId?: string | undefined;
}): Accessor<DenialView | undefined> {
  const view = useDenialView({
    get decision() {
      return props.decision ?? NOT_DENIED;
    },
    get icon() {
      return props.icon;
    },
    get testId() {
      return props.testId;
    },
  });
  return () =>
    props.decision === null || props.decision.allowed ? undefined : view();
}
