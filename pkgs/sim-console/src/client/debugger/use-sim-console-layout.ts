import { useBreakpoint } from '@pkgs/ui-rn';

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
  const { preference } = useClientLayoutPreference();
  return simConsoleLayoutFromBreakpoint(useBreakpoint(), preference);
}
