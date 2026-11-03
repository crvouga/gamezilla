import { ActionNotice } from '@pkgs/ui-root-client-ts/action-notice';
import type { IconComponent } from '@pkgs/ui-root-client-ts/create-icon';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { type JSX, Show } from 'solid-js';

/** What a resolved denial shows: copy and the configured way forward. */
export type DenialView = {
  readonly icon: IconComponent;
  readonly title: string;
  readonly body?: string | undefined;
  /** The way forward, or undefined when the denial unlocks nothing. */
  readonly action?:
    | { readonly label: string; readonly onPress: () => void }
    | undefined;
  /** Spec handles: `testid`, `reason` and `policyVersion`. */
  readonly dataSet: Readonly<Record<string, string>>;
};

export type DenialSurfaceViewProps = {
  readonly denial: DenialView;
  /** `fill` takes the screen body; `compact` sits inline. Defaults to `fill`. */
  readonly variant?: 'fill' | 'compact' | undefined;
};

/**
 * Presentational half of `DenialSurface`: renders already-resolved denial
 * copy. Screen views take a `DenialView` so their denied state is a story;
 * only `DenialSurface` / `useDenialView` resolve a `Decision` into one.
 */
export function DenialSurfaceView(props: DenialSurfaceViewProps): JSX.Element {
  const action = () => {
    const forward = props.denial.action;
    return forward === undefined
      ? undefined
      : { label: <>{forward.label}</>, onClick: forward.onPress };
  };
  return (
    <Show
      when={props.variant === 'compact'}
      fallback={
        <EmptyState
          icon={props.denial.icon}
          title={props.denial.title}
          body={props.denial.body}
          action={action()}
          dataSet={props.denial.dataSet}
        />
      }
    >
      <ActionNotice
        icon={props.denial.icon}
        title={props.denial.title}
        body={props.denial.body}
        action={action()}
        dataSet={props.denial.dataSet}
      />
    </Show>
  );
}
