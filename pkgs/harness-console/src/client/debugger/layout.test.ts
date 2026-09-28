import { describe, expect, test } from 'bun:test';

import {
  harnessConsoleLayoutFromBreakpoint,
  showDebuggerInstanceTabs,
} from './layout';

describe('harnessConsoleLayoutFromBreakpoint', () => {
  test('mobile always uses single-column tabs', () => {
    expect(harnessConsoleLayoutFromBreakpoint('mobile', 'columns')).toEqual({
      compactChrome: true,
      multiClientColumns: false,
    });
    expect(harnessConsoleLayoutFromBreakpoint('mobile', 'tabs')).toEqual({
      compactChrome: true,
      multiClientColumns: false,
    });
  });

  test('tablet/desktop honor columns vs tabs preference', () => {
    expect(harnessConsoleLayoutFromBreakpoint('tablet', 'columns')).toEqual({
      compactChrome: false,
      multiClientColumns: true,
    });
    expect(harnessConsoleLayoutFromBreakpoint('desktop', 'tabs')).toEqual({
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
