import { describe, expect, test } from 'bun:test';

import { reconcileAction } from './reconcile-sim';
import { SIM_SPEC } from './sim-spec';
import type { SimDeviceRecord } from './simctl';

describe('SIM_SPEC', () => {
  test('ids are unique', () => {
    const ids = SIM_SPEC.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('names are unique', () => {
    const names = SIM_SPEC.map((row) => row.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test('ios rows pin device type and runtime', () => {
    for (const row of SIM_SPEC) {
      expect(row.platform).toBe('ios');
      expect(row.deviceType).toMatch(
        /^com\.apple\.CoreSimulator\.SimDeviceType\./
      );
      expect(row.runtime).toMatch(/^com\.apple\.CoreSimulator\.SimRuntime\./);
    }
  });
});

describe('reconcileAction', () => {
  const iphone = SIM_SPEC[0]!;

  test('create when missing', () => {
    expect(reconcileAction(iphone, undefined)).toBe('create');
  });

  test('reuse when name matches type and runtime', () => {
    const existing: SimDeviceRecord = {
      udid: 'abc',
      name: iphone.name,
      state: 'Shutdown',
      deviceTypeIdentifier: iphone.deviceType,
      runtimeIdentifier: iphone.runtime,
    };
    expect(reconcileAction(iphone, existing)).toBe('reuse');
  });

  test('recreate when type or runtime drifted', () => {
    const existing: SimDeviceRecord = {
      udid: 'abc',
      name: iphone.name,
      state: 'Shutdown',
      deviceTypeIdentifier:
        'com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro',
      runtimeIdentifier: iphone.runtime,
    };
    expect(reconcileAction(iphone, existing)).toBe('recreate');
  });
});
