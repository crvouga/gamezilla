import { UiTestError } from '../core/errors';
import type { WaitOptions } from '../core/wait';
import type { Driver } from '../driver/driver';
import { formatSelector } from '../selector/format';
import type { Selector } from '../selector/selector';

export type AssertionOptions = WaitOptions;

/** Poll until `target` is visible, then return. Throws on timeout. */
export async function expectVisible(
  driver: Driver,
  target: Selector,
  options?: AssertionOptions
): Promise<void> {
  await driver.waitFor(target, 'visible', {
    ...options,
    description: options?.description ?? `visible ${formatSelector(target)}`,
  });
}

/** Poll until `target` is hidden (or absent), then return. Throws on timeout. */
export async function expectHidden(
  driver: Driver,
  target: Selector,
  options?: AssertionOptions
): Promise<void> {
  await driver.waitFor(target, 'hidden', {
    ...options,
    description: options?.description ?? `hidden ${formatSelector(target)}`,
  });
}

/**
 * Poll until `target` is visible and its text equals (or contains) `expected`.
 * Throws {@link UiTestError} with the last observed text on mismatch timeout.
 */
export async function expectText(
  driver: Driver,
  target: Selector,
  expected: string,
  options?: AssertionOptions & { exact?: boolean }
): Promise<void> {
  const exact = options?.exact !== false;
  const description =
    options?.description ??
    `text ${exact ? 'equals' : 'contains'} "${expected}" on ${formatSelector(target)}`;

  await driver.waitFor(target, 'visible', { ...options, description });

  const actual = await driver.getText(target);
  const matches = exact
    ? actual === expected
    : (actual?.includes(expected) ?? false);

  if (!matches) {
    throw new UiTestError(
      `Expected text ${exact ? 'equals' : 'contains'} "${expected}" on ${formatSelector(target)}, got ${JSON.stringify(actual)}`
    );
  }
}
