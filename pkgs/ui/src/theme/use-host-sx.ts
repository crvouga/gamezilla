/**
 * Apply `sx` to a React Native host: RN `style` plus captured CSS for reports.
 */

import {
  COMPONENT_IDS_ENABLED,
  type ComponentDataSet,
  componentDataSet,
} from '../component-id';
import type { ResolvedRnStyle } from './sx';
import type { SxInput } from './sx-props';
import { useTheme } from './theme-context';

export type HostSx = {
  style: ResolvedRnStyle | undefined;
  dataSet: { dataSet?: ComponentDataSet };
};

export function useHostSx(
  name: string,
  sx: SxInput,
  dataSet?: ComponentDataSet
): HostSx {
  const theme = useTheme();
  const style = sx ? theme.sx(sx) : undefined;
  const css = COMPONENT_IDS_ENABLED && sx ? theme.css(sx) : undefined;
  return {
    style,
    dataSet: componentDataSet(name, {
      ...dataSet,
      ...(css !== undefined && css.length > 0 ? { css } : {}),
    }),
  };
}
