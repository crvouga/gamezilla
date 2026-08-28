import type { SimChromeKind } from '../../shared/sim-node';

export type SimConsoleLayout = {
  /** Mobile (&lt; 768): compact chrome + single client column. */
  readonly compactChrome: boolean;
  /** Tablet/desktop: side-by-side client columns. */
  readonly multiClientColumns: boolean;
};

export function simConsoleLayoutFromBreakpoint(
  breakpoint: 'mobile' | 'tablet' | 'desktop'
): SimConsoleLayout {
  const compactChrome = breakpoint === 'mobile';
  return {
    compactChrome,
    multiClientColumns: !compactChrome,
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
