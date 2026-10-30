/**
 * Small filled circle in a participant's color (e.g. log-bar leading mark).
 */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { componentDataAttrs } from '@pkgs/ui-root-shared-ts/component-id';

export type ParticipantDotProps = {
  color: string;
  /** Diameter in px. Defaults to 8. */
  size?: number;
  dataSet?: ComponentDataSet;
};

export function ParticipantDot(props: ParticipantDotProps) {
  return (
    <div
      class="box"
      style={{
        'border-radius': `${(props.size ?? 8) / 2}px`,
        'background-color': props.color,
        width: `${props.size ?? 8}px`,
        height: `${props.size ?? 8}px`,
      }}
      {...componentDataAttrs('ParticipantDot', props.dataSet)}
    />
  );
}
