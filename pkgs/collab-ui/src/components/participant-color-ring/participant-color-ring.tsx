/**
 * Colored ring around a child (typically an avatar) identifying a participant.
 */

import { Box, type ComponentDataSet, componentDataAttrs } from '@pkgs/ui';
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
    <Box
      {...componentDataAttrs('ParticipantColorRing', props.dataSet)}
      sx={{
        ...(props.size !== undefined
          ? {
              width: props.size,
              height: props.size,
              borderRadius: props.size / 2,
            }
          : {}),
        borderWidth: props.borderWidth ?? 2,
        borderColor: props.color,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {props.children}
    </Box>
  );
}
