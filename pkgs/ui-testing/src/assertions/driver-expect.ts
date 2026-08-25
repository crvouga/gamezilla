import type {
  AssertionOptions,
  DriverWaitOptions,
  WaitState,
  WaitTextCondition,
} from '../driver/driver';
import { formatTestId } from '../selector/format';

/** Minimal host for shared expect wrappers — only {@link wait}. */
type ExpectHost = {
  wait(
    testId: string,
    state: WaitState | WaitTextCondition,
    options?: DriverWaitOptions
  ): Promise<void>;
};

/** Shared expect implementations — thin wrappers over {@link ExpectHost.wait}. */
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

  await driver.wait(
    testId,
    { text: expected, ...(options?.exact !== undefined ? { exact } : {}) },
    {
      ...(options?.timeoutMs !== undefined
        ? { timeoutMs: options.timeoutMs }
        : {}),
      description,
    }
  );
}
