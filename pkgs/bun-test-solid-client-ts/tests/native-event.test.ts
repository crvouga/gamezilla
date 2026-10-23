import { expect, test } from 'bun:test';
import {
  eventConstructor,
  rememberNativeEvent,
} from '@pkgs/bun-test-solid-client-ts/native-event';

test('a remembered constructor wins over the view Event', () => {
  class Saved extends Event {}
  const previous = rememberNativeEvent(Saved);
  try {
    expect(eventConstructor({ Event })).toBe(Saved);
  } finally {
    rememberNativeEvent(previous);
  }
});

test('the view Event is used when none was remembered', () => {
  const previous = rememberNativeEvent(undefined);
  try {
    expect(eventConstructor({ Event })).toBe(Event);
  } finally {
    rememberNativeEvent(previous);
  }
});
