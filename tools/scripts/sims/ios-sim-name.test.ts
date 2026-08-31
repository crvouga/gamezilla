import { describe, expect, test } from 'bun:test';

import { iosSimName, kebabSimSegment } from './ios-sim-name';

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
