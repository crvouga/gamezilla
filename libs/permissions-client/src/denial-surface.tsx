import { useClock } from '@pkgs/clock-client/solid';
import type { Decision } from '@pkgs/permissions-shared/decision';
import { ActionNotice } from '@pkgs/ui-root-client/action-notice';
import type { IconComponent } from '@pkgs/ui-root-client/create-icon';
import { EmptyState } from '@pkgs/ui-root-client/empty-state';
import { ClockIcon, KeyRoundIcon } from '@pkgs/ui-root-client/icons';
import { createMemo, type JSX, Show } from 'solid-js';
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

export type DenialContent = {
  readonly icon: () => IconComponent;
  readonly title: () => string;
  readonly body: () => string | undefined;
  /** The configured way forward, or undefined when the denial unlocks nothing. */
  readonly action: () =>
    | { readonly label: string; readonly run: () => void }
    | undefined;
  readonly dataSet: () => Record<string, string>;
};

/**
 * Resolves a `Decision` to what every denial surface shows: its `unlockRef`'s
 * config copy, the CTA, and the handles a spec reads.
 */
export function useDenialContent(props: {
  readonly decision: Decision;
  readonly icon?: IconComponent | undefined;
  readonly testId?: string | undefined;
}): DenialContent {
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
    return { label, run: () => unlock.run(props.decision) };
  });
  return {
    icon: () =>
      props.icon ??
      (props.decision.reason === 'quota_exhausted' ? ClockIcon : KeyRoundIcon),
    title: () =>
      unlockCopy(entry()?.titleKey) ?? denialReasonTitle(props.decision.reason),
    body,
    action,
    dataSet: () => ({
      testid: props.testId ?? 'permission-denial',
      reason: props.decision.reason ?? 'not_granted',
      policyVersion: props.decision.policyVersion,
    }),
  };
}

/**
 * The one denial / unlock surface (§22.5): renders a `Decision` by resolving
 * its `unlockRef` to config copy and CTA. The only place upsell or sign-in
 * copy renders (with `DenialModal`, its modal form), so a denied sub shows
 * this and nothing of its own.
 */
export function DenialSurface(props: DenialSurfaceProps): JSX.Element {
  const content = useDenialContent(props);
  const action = () => {
    const forward = content.action();
    return forward === undefined
      ? undefined
      : { label: <>{forward.label}</>, onClick: forward.run };
  };
  return (
    <Show
      when={props.variant === 'compact'}
      fallback={
        <EmptyState
          icon={content.icon()}
          title={content.title()}
          body={content.body()}
          action={action()}
          dataSet={content.dataSet()}
        />
      }
    >
      <ActionNotice
        icon={content.icon()}
        title={content.title()}
        body={content.body()}
        action={action()}
        dataSet={content.dataSet()}
      />
    </Show>
  );
}
