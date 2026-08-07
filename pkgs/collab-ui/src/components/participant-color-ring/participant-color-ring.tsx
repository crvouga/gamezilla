/**
 * Colored ring around a child (typically an avatar) identifying a participant.
 */

import { type ComponentDataSet, componentDataSet } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { View } from 'react-native';

export type ParticipantColorRingProps = {
  color: string;
  children: ReactNode;
  /** Outer diameter of the ring box. Defaults to matching child + pad. */
  size?: number;
  borderWidth?: number;
  dataSet?: ComponentDataSet;
};

export function ParticipantColorRing({
  color,
  children,
  size,
  borderWidth = 2,
  dataSet,
}: ParticipantColorRingProps) {
  return (
    <View
      {...componentDataSet('ParticipantColorRing', dataSet)}
      style={{
        width: size,
        height: size,
        borderRadius: size !== undefined ? size / 2 : undefined,
        borderWidth,
        borderColor: color,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}
