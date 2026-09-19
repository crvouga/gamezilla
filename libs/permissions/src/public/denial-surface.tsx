import { useClock } from '@pkgs/clock/solid';
import type { Decision } from '@pkgs/permissions';
import { ClockIcon, EmptyState, KeyRoundIcon, useRouter } from '@pkgs/ui';
import { createMemo, type JSX } from 'solid-js';

import {
  denialReasonTitle,
  resetsInLabel,
  unlockCopy,
  unlockCtaLabel,
  unlockCtaRoute,
} from './unlock-copy';
import { usePermissions } from './use-permissions';

export type DenialSurfaceProps = {
  readonly decision: Decision;
  /** Override CTA handling; default navigates to the target's route. */
  readonly onCta?: (target: string) => void;
  /** `data-testid` for E2E / sim handles. */
  readonly testId?: string;
};

/**
 * The one denial / unlock surface (§22.5): renders a `Decision` by resolving
 * its `unlockRef` to config copy and CTA. The only place upsell copy renders.
 */
export function DenialSurface(props: DenialSurfaceProps): JSX.Element {
  const permissions = usePermissions();
  const clock = useClock();
  const router = useRouter();
  const openCta = (target: string): void => {
    if (props.onCta !== undefined) {
      props.onCta(target);
      return;
    }
    const route = unlockCtaRoute(target);
    if (route !== undefined) router.push(route);
  };
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
    const label = unlockCtaLabel(entry()?.ctaTarget);
    if (label === undefined) return undefined;
    return {
      label: <>{label}</>,
      onClick: () => {
        const target = entry()?.ctaTarget;
        if (target !== undefined) openCta(target);
      },
    };
  });
  return (
    <EmptyState
      icon={
        props.decision.reason === 'quota_exhausted' ? ClockIcon : KeyRoundIcon
      }
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
