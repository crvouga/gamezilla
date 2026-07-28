import type { ReactNode } from 'react';
import { View } from 'react-native';
import { componentDataSet, type ComponentDataSet } from '../../component-id';
import { spacing } from '../../theme/scale';
import { HorizontalPickerArrow } from './horizontal-picker-arrows';

export type HorizontalPickerShellProps = {
  showArrows: boolean;
  clamped: number;
  itemCount: number;
  onPrev: () => void;
  onNext: () => void;
  children: ReactNode;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export function HorizontalPickerShell({
  showArrows,
  clamped,
  itemCount,
  onPrev,
  onNext,
  children,
  dataSet,
}: HorizontalPickerShellProps): ReactNode {
  return (
    <View
      {...componentDataSet('HorizontalPicker', dataSet)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}
    >
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
