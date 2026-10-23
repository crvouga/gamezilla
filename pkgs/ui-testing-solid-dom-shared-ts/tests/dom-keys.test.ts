import { describe, expect, test } from 'bun:test';
import type { DriverKey } from '@pkgs/ui-testing-root-shared-ts/keys';
import { DRIVER_KEY_TO_DOM } from '@pkgs/ui-testing-root-shared-ts/keys';
import {
  DRIVER_KEY_TO_USER_EVENT,
  escapeUserEventText,
  userEventKeyFromDom,
} from '@pkgs/ui-testing-solid-dom-shared-ts/dom-keys';

describe('dom keys', () => {
  test('every portable key has a user-event descriptor', () => {
    for (const key of Object.keys(DRIVER_KEY_TO_DOM) as DriverKey[]) {
      expect(DRIVER_KEY_TO_USER_EVENT[key]).toBeString();
    }
  });

  test('DOM identifiers map back to their descriptor', () => {
    expect(userEventKeyFromDom('ArrowLeft')).toBe('{ArrowLeft}');
    expect(userEventKeyFromDom('Home')).toBe('{Home}');
    expect(userEventKeyFromDom('End')).toBe('{End}');
  });

  test('unmapped printable keys type as themselves', () => {
    expect(userEventKeyFromDom('a')).toBe('a');
    expect(escapeUserEventText('{a}')).toBe('{{a}');
  });
});
