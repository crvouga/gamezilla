/**
 * Injectable bottom-sheet surface used by {@link ResponsiveSurface} and
 * app portal chrome. Wall = `@gorhom/bottom-sheet`; sim/DST = passthrough.
 */

import type {
  ComponentType,
  ForwardRefExoticComponent,
  PropsWithChildren,
  ReactElement,
  ReactNode,
  RefAttributes,
} from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export type BottomSheetModalMethods = {
  present: () => void;
  dismiss: () => void;
};

/** Props ResponsiveSurface forwards onto the host backdrop. */
export type BottomSheetHostBackdropProps = {
  disappearsOnIndex?: number;
  appearsOnIndex?: number;
  opacity?: number;
  pressBehavior?: 'none' | 'close' | 'collapse' | number;
  children?: ReactNode;
};

export type BottomSheetHostModalProps = PropsWithChildren<{
  enableDynamicSizing?: boolean;
  maxDynamicContentSize?: number;
  snapPoints?: (string | number)[];
  stackBehavior?: 'push' | 'switch' | 'replace';
  enablePanDownToClose?: boolean;
  onDismiss?: () => void;
  onChange?: (index: number) => void;
  backdropComponent?: (
    props: BottomSheetHostBackdropProps
  ) => ReactElement | null;
  handleIndicatorStyle?: StyleProp<ViewStyle>;
  backgroundStyle?: StyleProp<ViewStyle>;
  containerComponent?: ComponentType<PropsWithChildren>;
}>;

export type BottomSheetHostViewProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Web DOM / E2E data attributes from {@link componentDataSet}. */
  dataSet?: Record<string, string | undefined>;
  [key: string]: unknown;
}>;

export type BottomSheetHost = {
  readonly Provider: ComponentType<PropsWithChildren>;
  readonly Modal: ForwardRefExoticComponent<
    BottomSheetHostModalProps & RefAttributes<BottomSheetModalMethods>
  >;
  readonly View: ComponentType<BottomSheetHostViewProps>;
  readonly Backdrop: ComponentType<BottomSheetHostBackdropProps>;
};
