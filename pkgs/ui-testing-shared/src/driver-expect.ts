import type {
  AssertionOptions,
  DriverWaitOptions,
  WaitState,
  WaitTextCondition,
} from './driver';

/** Minimal host for shared expect wrappers — only {@link wait}. */
type ExpectHost = {
  wait(
    state: WaitState | WaitTextCondition,
    options?: DriverWaitOptions
  ): Promise<void>;
};

/** Shared expect implementations — thin wrappers over {@link ExpectHost.wait}. */
export async function runExpectVisible(
  node: ExpectHost,
  options?: AssertionOptions
): Promise<void> {
  await node.wait('visible', {
    ...options,
    description: options?.description ?? 'visible',
  });
}

export async function runExpectHidden(
  node: ExpectHost,
  options?: AssertionOptions
): Promise<void> {
  await node.wait('hidden', {
    ...options,
    description: options?.description ?? 'hidden',
  });
}

export async function runExpectText(
  node: ExpectHost,
  expected: string,
  options?: AssertionOptions & { exact?: boolean }
): Promise<void> {
  const exact = options?.exact !== false;
  const description =
    options?.description ??
    `text ${exact ? 'equals' : 'contains'} "${expected}"`;

  await node.wait(
    { text: expected, ...(options?.exact !== undefined ? { exact } : {}) },
    {
      ...(options?.timeoutMs !== undefined
        ? { timeoutMs: options.timeoutMs }
        : {}),
      description,
    }
  );
}
