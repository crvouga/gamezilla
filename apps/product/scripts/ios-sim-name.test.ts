import { describe, expect, test } from 'bun:test';

import { iosSimName, kebabSimSegment } from './ios-sim-name';
import {
  isProjectSimName,
  projectSimName,
  SIM_PROJECT_SLUG,
} from './sim-project';

describe('kebabSimSegment', () => {
  test('strips simctl device-type prefix', () => {
    expect(
      kebabSimSegment(
        'com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro',
        'com.apple.CoreSimulator.SimDeviceType.'
      )
    ).toBe('iphone-17-pro');
  });

  test('kebab-cases a human runtime name', () => {
    expect(
      kebabSimSegment('iOS 26.0', 'com.apple.CoreSimulator.SimRuntime.')
    ).toBe('ios-26-0');
  });
});

describe('iosSimName', () => {
  test('joins type and runtime identifiers', () => {
    expect(
      iosSimName(
        'com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro',
        'com.apple.CoreSimulator.SimRuntime.iOS-26-0'
      )
    ).toBe('iphone-17-pro-ios-26-0');
  });

  test('does not include a product slug', () => {
    expect(
      iosSimName(
        'com.apple.CoreSimulator.SimDeviceType.iPhone-16',
        'com.apple.CoreSimulator.SimRuntime.iOS-18-5'
      )
    ).toBe('iphone-16-ios-18-5');
  });
});

describe('projectSimName', () => {
  test('prefixes with project slug', () => {
    expect(
      projectSimName(
        'com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro',
        'com.apple.CoreSimulator.SimRuntime.iOS-26-0'
      )
    ).toBe(`${SIM_PROJECT_SLUG}-iphone-17-pro-ios-26-0`);
  });
});

describe('isProjectSimName', () => {
  test('matches project-owned names', () => {
    expect(isProjectSimName(`${SIM_PROJECT_SLUG}-iphone-17-pro-ios-26-0`)).toBe(
      true
    );
  });

  test('rejects foreign sim names', () => {
    expect(isProjectSimName('iphone-17-pro-ios-26-0')).toBe(false);
    expect(isProjectSimName('other-project-iphone')).toBe(false);
  });
});
