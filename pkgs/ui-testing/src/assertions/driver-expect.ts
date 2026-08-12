import { UiTestError } from '../core/errors';
import type { WaitPollOptions } from '../core/wait';
import { formatSelector } from '../selector/format';
import type { Selector } from '../selector/selector';

export type AssertionOptions = WaitPollOptions;

/** waitFor + getText only — do not import {@link Driver} (circular). */
type ExpectHost = {
  waitFor(
    target: Selector,
    state: 'visible' | 'hidden',
    options?: WaitPollOptions
  ): Promise<void>;
  getText(target: Selector): Promise<string | null>;
};

/** Shared expect implementations for concrete {@link Driver} classes. */
export async function runExpectVisible(
  driver: ExpectHost,
  target: Selector,
  options?: AssertionOptions
): Promise<void> {
  await driver.waitFor(target, 'visible', {
    ...options,
    description: options?.description ?? `visible ${formatSelector(target)}`,
  });
}

export async function runExpectHidden(
  driver: ExpectHost,
  target: Selector,
  options?: AssertionOptions
): Promise<void> {
  await driver.waitFor(target, 'hidden', {
    ...options,
    description: options?.description ?? `hidden ${formatSelector(target)}`,
  });
}

export async function runExpectText(
  driver: ExpectHost,
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
