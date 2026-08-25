import { NotImplementedError } from '../../core/errors';
import type { DriverKey } from '../../core/keys';
import type {
  AssertionOptions,
  Driver,
  DriverWaitOptions,
  ScrollDirection,
  TapPosition,
  UiWaitOptions,
  WaitState,
  WaitTextCondition,
} from '../../driver/driver';

/**
 * Minimal structural surface of Detox that a real implementation would use.
 * No `detox` package dependency — consumers inject their device/by matchers.
 *
 * Mapping (for a future full implementation):
 * - testId → `by.id(value)`
 * - tap → `element(matcher).tap()` (after wait-until-visible)
 * - tapAt → `element(matcher).tap({ x, y })` (absolute coords from ratios)
 * - typeText → `element(matcher).typeText(text)` (after wait-until-visible)
 * - clearText → `element(matcher).clearText()`
 * - pressKey → platform key APIs (limited)
 * - scroll → `element(matcher).scroll(amount, direction)`
 * - wait visible → `waitFor(element(matcher)).toBeVisible()`
 * - wait hidden → `waitFor(element(matcher)).not.toBeVisible()`
 * - wait text → unsupported in classic Detox (no text read-back API)
 * - getText → **unsupported** in classic Detox (no text read-back API)
 */
export type DetoxLike = {
  device: {
    launchApp: (params?: Record<string, unknown>) => Promise<void>;
    terminateApp: () => Promise<void>;
    pressBack: () => Promise<void>;
  };
};

export type DetoxDriverOptions = {
  detox: DetoxLike;
};

/**
 * Stub Detox driver. Satisfies {@link Driver} so the architecture is proven;
 * every operation throws {@link NotImplementedError} until a real Detox
 * integration is wired by a consumer who owns the Detox dependency.
 */
export class DetoxDriver implements Driver {
  readonly kind = 'detox';

  readonly expect: Driver['expect'] = {
    visible: (testId, options) => this.expectVisible(testId, options),
    hidden: (testId, options) => this.expectHidden(testId, options),
    text: (testId, expected, options) =>
      this.expectText(testId, expected, options),
  };

  // Reserved for the future implementation that will call into Detox.
  constructor(_options: DetoxDriverOptions) {
    void _options;
  }

  async launch(): Promise<void> {
    this.unsupported('launch', 'device.launchApp()');
  }

  async close(): Promise<void> {
    this.unsupported('close', 'device.terminateApp()');
  }

  async tap(_testId: string, _options?: UiWaitOptions): Promise<void> {
    this.unsupported('tap', 'element(matcher).tap()');
  }

  async tapAt(_testId: string, _position: TapPosition): Promise<void> {
    this.unsupported('tapAt', 'element(matcher).tap({ x, y })');
  }

  async input(
    _testId: string,
    _text: string,
    _options?: UiWaitOptions
  ): Promise<void> {
    this.unsupported('typeText', 'element(matcher).typeText(text)');
  }

  async clear(_testId: string): Promise<void> {
    this.unsupported('clearText', 'element(matcher).clearText()');
  }

  async key(_key: DriverKey): Promise<void> {
    this.unsupported('pressKey', 'platform key APIs');
  }

  async scroll(
    _testId: string,
    _direction: ScrollDirection,
    _amount?: number
  ): Promise<void> {
    this.unsupported('scroll', 'element(matcher).scroll(amount, direction)');
  }

  async wait(
    _testId: string,
    _state: WaitState | WaitTextCondition,
    _options?: DriverWaitOptions
  ): Promise<void> {
    this.unsupported(
      'wait',
      'waitFor(element(matcher)).toBeVisible() / not.toBeVisible()'
    );
  }

  async isVisible(_testId: string): Promise<boolean> {
    this.unsupported('isVisible', 'expect(element(matcher)).toBeVisible()');
  }

  async getText(_testId: string): Promise<string | null> {
    this.unsupported('getText', 'Detox has no first-class text read-back API');
  }

  async snapshotHtml(): Promise<string | null> {
    return null;
  }

  private async expectVisible(
    _testId: string,
    _options?: AssertionOptions
  ): Promise<void> {
    this.unsupported(
      'expect.visible',
      'waitFor(element(matcher)).toBeVisible()'
    );
  }

  private async expectHidden(
    _testId: string,
    _options?: AssertionOptions
  ): Promise<void> {
    this.unsupported(
      'expect.hidden',
      'waitFor(element(matcher)).not.toBeVisible()'
    );
  }

  private async expectText(
    _testId: string,
    _expected: string,
    _options?: AssertionOptions & { exact?: boolean }
  ): Promise<void> {
    this.unsupported(
      'expect.text',
      'Detox has no first-class text read-back API'
    );
  }

  private unsupported(operation: string, mapping: string): never {
    throw new NotImplementedError(this.kind, operation, mapping);
  }
}
