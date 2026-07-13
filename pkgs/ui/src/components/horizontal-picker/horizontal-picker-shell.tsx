import type { ReactNode } from 'react';
import { View } from 'react-native';
import { spacing } from '../../theme/scale';
import { HorizontalPickerArrow } from './horizontal-picker-arrows';

export type HorizontalPickerShellProps = {
  showArrows: boolean;
  clamped: number;
  itemCount: number;
  onPrev: () => void;
  onNext: () => void;
  children: ReactNode;
};

export function HorizontalPickerShell({
  showArrows,
  clamped,
  itemCount,
  onPrev,
  onNext,
  children,
}: HorizontalPickerShellProps): ReactNode {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
      {showArrows ? (
        <HorizontalPickerArrow
          direction="prev"
          disabled={clamped <= 0}
          onPress={onPrev}
        />
      ) : null}
      {children}
      {showArrows ? (
        <HorizontalPickerArrow
          direction="next"
          disabled={clamped >= itemCount - 1}
          onPress={onNext}
        />
      ) : null}
    </View>
  );
}
