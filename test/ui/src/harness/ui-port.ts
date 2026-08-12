import type { Handle } from '@libs/dst-handles';

export type UiWaitOptions = { readonly timeoutMs?: number };

export type UiPort = {
  /** Wait until visible, then tap. */
  tap(handle: Handle, options?: UiWaitOptions): Promise<void>;
  /** Wait until visible, then replace text. */
  input(handle: Handle, value: string, options?: UiWaitOptions): Promise<void>;
  expectVisible(handle: Handle, options?: UiWaitOptions): Promise<void>;
  expectHidden(handle: Handle, options?: UiWaitOptions): Promise<void>;
  /** Assert text value on a handled control (inputs / labeled fields). */
  expectText(
    handle: Handle,
    text: string,
    options?: UiWaitOptions & { readonly exact?: boolean }
  ): Promise<void>;
  /**
   * Escape hatch when the *copy itself* is under test.
   * Same mechanics as expectText; named distinctly so greps/docs mark it.
   * Drivers must not use raw by.text.
   */
  expectCopy(
    handle: Handle,
    text: string,
    options?: UiWaitOptions
  ): Promise<void>;
};
