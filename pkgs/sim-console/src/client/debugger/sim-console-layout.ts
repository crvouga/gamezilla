import type { SimChromeKind } from '../../shared/sim-node';

/** User preference for multi-client layout on tablet/desktop. */
export type ClientLayoutMode = 'columns' | 'tabs';

export type SimConsoleLayout = {
  /** Mobile (&lt; 768): compact chrome + single client column. */
  readonly compactChrome: boolean;
  /** Side-by-side client columns (tablet/desktop preference, never on mobile). */
  readonly multiClientColumns: boolean;
};

export function simConsoleLayoutFromBreakpoint(
  breakpoint: 'mobile' | 'tablet' | 'desktop',
  clientLayout: ClientLayoutMode = 'columns'
): SimConsoleLayout {
  const compactChrome = breakpoint === 'mobile';
  return {
    compactChrome,
    multiClientColumns: !compactChrome && clientLayout === 'columns',
  };
}

/** Instance tabs: always for non-client; for clients only when single-column. */
export function showDebuggerInstanceTabs(args: {
  readonly kind: SimChromeKind;
  readonly instanceCount: number;
  readonly multiClientColumns: boolean;
}): boolean {
  if (args.instanceCount <= 1) return false;
  if (args.kind !== 'client') return true;
  return !args.multiClientColumns;
}
