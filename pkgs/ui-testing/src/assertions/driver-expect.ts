import type { Timers } from '@pkgs/clock';

import { UiTestError } from '../core/errors';
import { type WaitPollOptions, waitUntil } from '../core/wait';
import { formatTestId } from '../selector/format';

export type AssertionOptions = WaitPollOptions;

/** wait + getText only — do not import {@link Driver} (circular). */
type ExpectHost = {
  wait(
    testId: string,
    state: 'visible' | 'hidden',
    options?: WaitPollOptions
  ): Promise<void>;
  getText(testId: string): Promise<string | null>;
  /** When set with `timers`, `expect.text` polls until the value matches. */
  now?: () => number;
  timers?: Timers;
};

function textMatches(
  actual: string | null,
  expected: string,
  exact: boolean
): boolean {
  return exact ? actual === expected : (actual?.includes(expected) ?? false);
}

/** Shared expect implementations for concrete {@link Driver} classes. */
export async function runExpectVisible(
  driver: ExpectHost,
  testId: string,
  options?: AssertionOptions
): Promise<void> {
  await driver.wait(testId, 'visible', {
    ...options,
    description: options?.description ?? `visible ${formatTestId(testId)}`,
  });
}

export async function runExpectHidden(
  driver: ExpectHost,
  testId: string,
  options?: AssertionOptions
): Promise<void> {
  await driver.wait(testId, 'hidden', {
    ...options,
    description: options?.description ?? `hidden ${formatTestId(testId)}`,
  });
}

export async function runExpectText(
  driver: ExpectHost,
  testId: string,
  expected: string,
  options?: AssertionOptions & { exact?: boolean }
): Promise<void> {
  const exact = options?.exact !== false;
  const description =
    options?.description ??
    `text ${exact ? 'equals' : 'contains'} "${expected}" on ${formatTestId(testId)}`;

  await driver.wait(testId, 'visible', { ...options, description });

  const { now, timers } = driver;
  if (now === undefined || timers === undefined) {
    const actual = await driver.getText(testId);
    if (!textMatches(actual, expected, exact)) {
      throw new UiTestError(
        `Expected text ${exact ? 'equals' : 'contains'} "${expected}" on ${formatTestId(testId)}, got ${JSON.stringify(actual)}`
      );
    }
    return;
  }

  let lastActual: string | null = null;
  try {
    await waitUntil(
      async () => {
        lastActual = await driver.getText(testId);
        return textMatches(lastActual, expected, exact) ? true : null;
      },
      {
        ...options,
        description,
        now,
        timers,
      }
    );
  } catch (error) {
    throw new UiTestError(
      `Expected text ${exact ? 'equals' : 'contains'} "${expected}" on ${formatTestId(testId)}, got ${JSON.stringify(lastActual)}`,
      { cause: error }
    );
  }
}
