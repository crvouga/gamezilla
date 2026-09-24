import { useClock } from '@pkgs/clock/solid';
import type { Decision } from '@pkgs/permissions';
import {
  ClockIcon,
  EmptyState,
  type IconComponent,
  KeyRoundIcon,
} from '@pkgs/ui';
import { createMemo, type JSX } from 'solid-js';

import {
  denialReasonTitle,
  resetsInLabel,
  unlockCopy,
} from '../use-cases/decide-access/client/unlock-copy';
import { useUnlock } from './unlock';
import { usePermissions } from './use-permissions';

export type DenialSurfaceProps = {
  readonly decision: Decision;
  /** The surface's glyph; defaults to a clock (quota) or a key. */
  readonly icon?: IconComponent | undefined;
  readonly variant?: 'fill' | 'compact' | undefined;
  /** `data-testid` for E2E / sim handles; the CTA is `<testId>-action`. */
  readonly testId?: string;
};

/**
 * The one denial / unlock surface (§22.5): renders a `Decision` by resolving
 * its `unlockRef` to config copy and CTA. The only place upsell or sign-in
 * copy renders, so a denied feature shows this and nothing of its own.
 */
export function DenialSurface(props: DenialSurfaceProps): JSX.Element {
  const permissions = usePermissions();
  const unlock = useUnlock();
  const clock = useClock();
  const entry = createMemo(() => permissions.unlock(props.decision));
  const body = createMemo(() => {
    const copy = unlockCopy(entry()?.bodyKey);
    const resetsAt = props.decision.resetsAtMs;
    if (copy !== undefined) return copy;
    return resetsAt === undefined
      ? undefined
      : resetsInLabel(resetsAt, clock.now());
  });
  const action = createMemo(() => {
    const label = unlock.label(props.decision);
    if (label === undefined) return undefined;
    return {
      label: <>{label}</>,
      onClick: () => unlock.run(props.decision),
    };
  });
  const icon = createMemo(
    () =>
      props.icon ??
      (props.decision.reason === 'quota_exhausted' ? ClockIcon : KeyRoundIcon)
  );
  return (
    <EmptyState
      variant={props.variant}
      icon={icon()}
      title={
        <>
          {unlockCopy(entry()?.titleKey) ??
            denialReasonTitle(props.decision.reason)}
        </>
      }
      body={body() === undefined ? undefined : <>{body()}</>}
      action={action()}
      dataSet={{
        testid: props.testId ?? 'permission-denial',
        reason: props.decision.reason ?? 'not_granted',
        policyVersion: props.decision.policyVersion,
      }}
    />
  );
}
