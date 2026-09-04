import { describe, expect, test } from 'bun:test';

import { reconcileAction } from './reconcile-sim';
import { isProjectSimName, SIM_PROJECT_SLUG } from './sim-project';
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

  test('names are project-prefixed', () => {
    for (const row of SIM_SPEC) {
      expect(row.name.startsWith(`${SIM_PROJECT_SLUG}-`)).toBe(true);
      expect(isProjectSimName(row.name)).toBe(true);
    }
  });
});

describe('listProjectDevices', () => {
  test('isProjectSimName filters foreign sims', () => {
    const names = [
      `${SIM_PROJECT_SLUG}-iphone-17-pro-ios-26-0`,
      'foreign-iphone',
    ];
    expect(names.filter((name) => isProjectSimName(name))).toEqual([
      `${SIM_PROJECT_SLUG}-iphone-17-pro-ios-26-0`,
    ]);
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

  test('recreate when device data is missing on disk', () => {
    const existing: SimDeviceRecord = {
      udid: 'abc',
      name: iphone.name,
      state: 'Shutdown',
      deviceTypeIdentifier: iphone.deviceType,
      runtimeIdentifier: iphone.runtime,
    };
    expect(reconcileAction(iphone, existing, { dataPresent: false })).toBe(
      'recreate'
    );
  });
});
