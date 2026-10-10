import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import type { JSX } from 'solid-js';

/** Matches `--ui-radius-lg` / `rounded-card`. Compact docks pass 0 to sit flush. */
export const SPACE_CARD_BORDER_RADIUS = 20;

export type SpaceCardSurfaceProps = {
  children: JSX.Element;
  class?: string | undefined;
  style?: JSX.CSSProperties | undefined;
  dataSet?: ComponentDataSet | undefined;
};

/** One surface card. Lists use `.panel` instead of stacking these. */
export function SpaceCardSurface(props: SpaceCardSurfaceProps): JSX.Element {
  return (
    <div
      class={`box w-full self-stretch bg-surface border border-border rounded-card ${props.class ?? ''}`.trim()}
      style={props.style}
      {...dataAttrs(props.dataSet)}
    >
      {props.children}
    </div>
  );
}
