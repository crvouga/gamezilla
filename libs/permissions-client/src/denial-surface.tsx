import { useClock } from '@pkgs/clock-client/solid';
import type { Decision } from '@pkgs/permissions-shared/decision';
import type { IconComponent } from '@pkgs/ui-root-client/create-icon';
import { EmptyState } from '@pkgs/ui-root-client/empty-state';
import { ClockIcon, KeyRoundIcon } from '@pkgs/ui-root-client/icons';
import { createMemo, type JSX } from 'solid-js';
import { useUnlock } from './unlock';
import { denialReasonTitle, resetsInLabel, unlockCopy } from './unlock-copy';
import { usePermissions } from './use-permissions';

export type DenialSurfaceProps = {
  readonly decision: Decision;
  /** The surface's glyph; defaults to a clock (quota) or a key. */
  readonly icon?: IconComponent | undefined;
  readonly variant?: 'fill' | 'compact' | undefined;
  /** `data-testid` for spec / harness handles; the CTA is `<testId>-action`. */
  readonly testId?: string;
};

/**
 * The one denial / unlock surface (§22.5): renders a `Decision` by resolving
 * its `unlockRef` to config copy and CTA. The only place upsell or sign-in
 * copy renders, so a denied sub shows this and nothing of its own.
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
