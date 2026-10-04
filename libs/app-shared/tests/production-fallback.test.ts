import { describe, expect, test } from 'bun:test';
import { setupI18n } from '@lingui/core';

describe('Lingui production missing-key fallback', () => {
  test('descriptor message is shown instead of the hashed id', () => {
    const isolated = setupI18n();
    isolated.loadAndActivate({ locale: 'en', messages: {} });
    expect(isolated._({ id: 'iDNBZe', message: 'Notifications' })).toBe(
      'Notifications'
    );
  });

  test('hashed id is shown when the source message was stripped', () => {
    const isolated = setupI18n();
    isolated.loadAndActivate({ locale: 'en', messages: {} });
    expect(isolated._({ id: 'iDNBZe' })).toBe('iDNBZe');
  });
});
