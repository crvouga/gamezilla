import { useBreakpoint } from '@pkgs/ui';

import {
  type SimConsoleLayout,
  simConsoleLayoutFromBreakpoint,
} from './sim-console-layout';

export type { SimConsoleLayout } from './sim-console-layout';
export {
  showDebuggerInstanceTabs,
  simConsoleLayoutFromBreakpoint,
} from './sim-console-layout';

export function useSimConsoleLayout(): SimConsoleLayout {
  return simConsoleLayoutFromBreakpoint(useBreakpoint());
}
