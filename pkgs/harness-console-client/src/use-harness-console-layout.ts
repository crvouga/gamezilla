import { useTheme } from '@pkgs/ui-root-client/theme-context';

import { useClientLayoutPreference } from './client-layout-preference';
import type { HarnessConsoleLayout } from './layout';
import { harnessConsoleLayoutFromBreakpoint } from './layout';

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
