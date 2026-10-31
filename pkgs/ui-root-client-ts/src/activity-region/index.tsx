/** @jsxImportSource solid-js */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';

export type ActivityRegionProps = {
  children?: JSX.Element | undefined;
  /** Runs on every pointer down inside the region. */
  onActivity: () => void;
  /** Claim the space the siblings leave (`flex-1`). */
  grow?: boolean | undefined;
  /** Rendered as `data-testid`. */
  testId?: string | undefined;
};

/**
 * `ActivityRegion` -- a layout box that notices the person doing something
 * inside it: any press (pointer down) anywhere in the region calls
 * `onActivity`. It is not a control: no role, no focus stop, no press tint,
 * and presses still reach the controls inside. Use it for idle detection
 * ("touching the space counts as being here").
 *
 * @example
 * ```tsx
 * <ActivityRegion grow onActivity={markActive}>
 *   {props.children}
 * </ActivityRegion>
 * ```
 */
export function ActivityRegion(props: ActivityRegionProps): JSX.Element {
  return (
    <div
      class="box"
      classList={{ 'flex-1': props.grow === true }}
      data-testid={props.testId}
      data-component={componentId('ActivityRegion')}
      onPointerDown={() => props.onActivity()}
    >
      {props.children}
    </div>
  );
}
