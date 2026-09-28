import { useTheme } from '@pkgs/ui';

import { useClientLayoutPreference } from './client-layout-preference';
import {
  type HarnessConsoleLayout,
  harnessConsoleLayoutFromBreakpoint,
} from './layout';

export {
  ClientLayoutPreferenceProvider,
  useClientLayoutPreference,
} from './client-layout-preference';
export type {
  ClientLayoutMode,
  HarnessConsoleLayout,
} from './layout';
export {
  harnessConsoleLayoutFromBreakpoint,
  showDebuggerInstanceTabs,
} from './layout';

export function useHarnessConsoleLayout(): HarnessConsoleLayout {
  const preference = useClientLayoutPreference();
  const theme = useTheme();
  const layout = () =>
    harnessConsoleLayoutFromBreakpoint(
      theme.breakpoint(),
      preference.preference
    );
  return {
    get compactChrome() {
      return layout().compactChrome;
    },
    get multiClientColumns() {
      return layout().multiClientColumns;
    },
  };
}
