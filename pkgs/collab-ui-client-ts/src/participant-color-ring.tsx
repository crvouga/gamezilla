/**
 * Colored ring around a child (typically an avatar) identifying a participant.
 */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { componentDataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';

export type ParticipantColorRingProps = {
  color: string;
  children: JSX.Element;
  /** Outer diameter of the ring box. Defaults to matching child + pad. */
  size?: number;
  borderWidth?: number;
  dataSet?: ComponentDataSet;
};

export function ParticipantColorRing(props: ParticipantColorRingProps) {
  return (
    <div
      class="box items-center justify-center overflow-hidden"
      style={{
        ...(props.size !== undefined
          ? {
              width: `${props.size}px`,
              height: `${props.size}px`,
              'border-radius': `${props.size / 2}px`,
            }
          : {}),
        'border-color': props.color,
        'border-width': `${props.borderWidth ?? 2}px`,
      }}
      {...componentDataAttrs('ParticipantColorRing', props.dataSet)}
    >
      {props.children}
    </div>
  );
}
