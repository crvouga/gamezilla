import { describe, expect, test } from 'bun:test';
import { reportsPublicBaseUrlFromHost } from './reports-public-base-core';

describe('reportsPublicBaseUrlFromHost', () => {
  test('web keeps the relative public path', () => {
    expect(
      reportsPublicBaseUrlFromHost({
        platformOs: 'web',
        hostUri: '192.168.0.1:5173',
      })
    ).toBe('/reports');
  });

  test('native uses the Metro host so Expo Go can fetch public/reports', () => {
    expect(
      reportsPublicBaseUrlFromHost({
        platformOs: 'ios',
        hostUri: '192.168.0.111:5173',
      })
    ).toBe('http://192.168.0.111:5173/reports');
  });

  test('native without hostUri falls back to the relative path', () => {
    expect(
      reportsPublicBaseUrlFromHost({
        platformOs: 'ios',
        hostUri: undefined,
      })
    ).toBe('/reports');
  });
});
