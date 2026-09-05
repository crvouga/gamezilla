import { describe, expect, test } from 'bun:test';

import {
  showDebuggerInstanceTabs,
  simConsoleLayoutFromBreakpoint,
} from './sim-console-layout';

describe('simConsoleLayoutFromBreakpoint', () => {
  test('mobile always uses single-column tabs', () => {
    expect(simConsoleLayoutFromBreakpoint('mobile', 'columns')).toEqual({
      compactChrome: true,
      multiClientColumns: false,
    });
    expect(simConsoleLayoutFromBreakpoint('mobile', 'tabs')).toEqual({
      compactChrome: true,
      multiClientColumns: false,
    });
  });

  test('tablet/desktop honor columns vs tabs preference', () => {
    expect(simConsoleLayoutFromBreakpoint('tablet', 'columns')).toEqual({
      compactChrome: false,
      multiClientColumns: true,
    });
    expect(simConsoleLayoutFromBreakpoint('desktop', 'tabs')).toEqual({
      compactChrome: false,
      multiClientColumns: false,
    });
  });
});

describe('showDebuggerInstanceTabs', () => {
  test('clients only get instance tabs when not multi-column', () => {
    expect(
      showDebuggerInstanceTabs({
        kind: 'client',
        instanceCount: 2,
        multiClientColumns: true,
      })
    ).toBe(false);
    expect(
      showDebuggerInstanceTabs({
        kind: 'client',
        instanceCount: 2,
        multiClientColumns: false,
      })
    ).toBe(true);
  });
});
