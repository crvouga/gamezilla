/** @jsxImportSource solid-js */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import type { IconComponent } from '../create-icon/index';

export type StatusIconSlotProps = {
  /** Whether the status holds; the slot stays either way. */
  shown: boolean;
  icon: IconComponent;
  /** What the status means, for assistive technology and the tooltip. */
  label: string;
  /** Rendered as `data-testid` on the shown status. */
  testId?: string | undefined;
};

/**
 * `StatusIconSlot` -- a fixed 32px slot in a bar that shows a status glyph
 * while the status holds, and keeps its room (empty) while it does not, so
 * the bar never reflows when the status comes and goes. The glyph is a
 * `status` region named by `label` (also its tooltip); color never carries
 * the status alone.
 *
 * @example
 * ```tsx
 * <StatusIconSlot shown={hostOffline()} icon={WifiOffIcon} label={t`The host is offline.`} />
 * ```
 */
export function StatusIconSlot(props: StatusIconSlotProps): JSX.Element {
  return (
    <div
      class="box h-8 w-8 shrink-0 items-center justify-center"
      data-component={componentId('StatusIconSlot')}
    >
      <Show when={props.shown}>
        <span role="status" title={props.label} data-testid={props.testId}>
          <props.icon size={20} color="icon" />
          <span class="sr-only">{props.label}</span>
        </span>
      </Show>
    </div>
  );
}
