/**
 * Small filled circle in a participant's color (e.g. log-bar leading mark).
 */

import { Box, type ComponentDataSet, componentDataAttrs } from '@pkgs/ui';

export type ParticipantDotProps = {
  color: string;
  /** Diameter in px. Defaults to 8. */
  size?: number;
  dataSet?: ComponentDataSet;
};

export function ParticipantDot(props: ParticipantDotProps) {
  return (
    <Box
      {...componentDataAttrs('ParticipantDot', props.dataSet)}
      sx={{
        width: props.size ?? 8,
        height: props.size ?? 8,
        borderRadius: (props.size ?? 8) / 2,
        backgroundColor: props.color,
      }}
    />
  );
}
