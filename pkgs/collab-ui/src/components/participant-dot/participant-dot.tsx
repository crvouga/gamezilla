/**
 * Small filled circle in a participant's color (e.g. log-bar leading mark).
 */

import { View } from 'react-native';

import { componentDataSet, type ComponentDataSet } from '@pkgs/ui';

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
    <View
      {...componentDataSet('ParticipantDot', dataSet)}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
      }}
    />
  );
}
