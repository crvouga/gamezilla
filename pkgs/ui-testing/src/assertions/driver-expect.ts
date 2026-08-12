import type { Timers } from '@pkgs/clock';

import { UiTestError } from '../core/errors';
import { type WaitPollOptions, waitUntil } from '../core/wait';
import { formatSelector } from '../selector/format';
import type { Selector } from '../selector/selector';

export type AssertionOptions = WaitPollOptions;

/** wait + getText only — do not import {@link Driver} (circular). */
type ExpectHost = {
  wait(
    target: Selector,
    state: 'visible' | 'hidden',
    options?: WaitPollOptions
  ): Promise<void>;
  getText(target: Selector): Promise<string | null>;
  /** When set with `timers`, `expectText` polls until the value matches. */
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
  target: Selector,
  options?: AssertionOptions
): Promise<void> {
  await driver.wait(target, 'visible', {
    ...options,
    description: options?.description ?? `visible ${formatSelector(target)}`,
  });
}

export async function runExpectHidden(
  driver: ExpectHost,
  target: Selector,
  options?: AssertionOptions
): Promise<void> {
  await driver.wait(target, 'hidden', {
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

  await driver.wait(target, 'visible', { ...options, description });

  const { now, timers } = driver;
  if (now === undefined || timers === undefined) {
    const actual = await driver.getText(target);
    if (!textMatches(actual, expected, exact)) {
      throw new UiTestError(
        `Expected text ${exact ? 'equals' : 'contains'} "${expected}" on ${formatSelector(target)}, got ${JSON.stringify(actual)}`
      );
    }
    return;
  }

  let lastActual: string | null = null;
  try {
    await waitUntil(
      async () => {
        lastActual = await driver.getText(target);
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
      `Expected text ${exact ? 'equals' : 'contains'} "${expected}" on ${formatSelector(target)}, got ${JSON.stringify(lastActual)}`,
      { cause: error }
    );
  }
}
