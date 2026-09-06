import { useTheme } from '@pkgs/ui';

import { useClientLayoutPreference } from './client-layout-preference';
import {
  type SimConsoleLayout,
  simConsoleLayoutFromBreakpoint,
} from './sim-console-layout';

export {
  ClientLayoutPreferenceProvider,
  useClientLayoutPreference,
} from './client-layout-preference';
export type { ClientLayoutMode, SimConsoleLayout } from './sim-console-layout';
export {
  showDebuggerInstanceTabs,
  simConsoleLayoutFromBreakpoint,
} from './sim-console-layout';

export function useSimConsoleLayout(): SimConsoleLayout {
  const preference = useClientLayoutPreference();
  const theme = useTheme();
  const layout = () =>
    simConsoleLayoutFromBreakpoint(theme.breakpoint(), preference.preference);
  return {
    get compactChrome() {
      return layout().compactChrome;
    },
    get multiClientColumns() {
      return layout().multiClientColumns;
    },
  };
}
