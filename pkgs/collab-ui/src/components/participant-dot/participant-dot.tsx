/**
 * Small filled circle in a participant's color (e.g. log-bar leading mark).
 */

import { Box, type ComponentDataSet, componentDataSet } from '@pkgs/ui';

export type ParticipantDotProps = {
  color: string;
  /** Diameter in px. Defaults to 8. */
  size?: number;
  dataSet?: ComponentDataSet;
};

export function ParticipantDot({
  color,
  size = 8,
  dataSet,
}: ParticipantDotProps) {
  return (
    <Box
      {...componentDataSet('ParticipantDot', dataSet)}
      sx={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
      }}
    />
  );
}
