import { expect, test } from 'bun:test';
import { createMotionPreference } from '@pkgs/device/motion-preference';

test('motion preference changes notify only the subscribed device and unsubscribe cleanly', () => {
  const first = createMotionPreference();
  const other = createMotionPreference();
  const received: boolean[] = [];
  const unsubscribe = first.subscribe((reduced) => received.push(reduced));
  first.setReduced(true);
  expect(first.reduced()).toBe(true);
  expect(other.reduced()).toBe(false);
  expect(received).toEqual([true]);
  unsubscribe();
  first.setReduced(false);
  expect(received).toEqual([true]);
});
