import { NotImplementedError } from '../../core/errors';
import type { DriverKey } from '../../core/keys';
import type { WaitOptions } from '../../core/wait';
import type {
  Driver,
  ScrollDirection,
  TapPosition,
  WaitState,
} from '../../driver/driver';
import type { Selector } from '../../selector/selector';

/**
 * Minimal structural surface of Detox that a real implementation would use.
 * No `detox` package dependency — consumers inject their device/by matchers.
 *
 * Mapping (for a future full implementation):
 * - testId → `by.id(value)`
 * - text → `by.text(value)`
 * - label → `by.label(value)`
 * - role → not first-class in Detox; approximate via label / traits
 * - nth → `element(matcher).atIndex(n)`
 * - tap → `element(matcher).tap()`
 * - tapAt → `element(matcher).tap({ x, y })` (absolute coords from ratios)
 * - typeText → `element(matcher).typeText(text)`
 * - clearText → `element(matcher).clearText()`
 * - pressKey → `device.pressBack()` / platform key APIs (limited)
 * - scroll → `element(matcher).scroll(amount, direction)`
 * - navigateBack → `device.pressBack()`
 * - waitFor visible → `waitFor(element(matcher)).toBeVisible()`
 * - waitFor hidden → `waitFor(element(matcher)).not.toBeVisible()`
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

  async tap(_target: Selector): Promise<void> {
    this.unsupported('tap', 'element(matcher).tap()');
  }

  async tapAt(_target: Selector, _position: TapPosition): Promise<void> {
    this.unsupported('tapAt', 'element(matcher).tap({ x, y })');
  }

  async typeText(_target: Selector, _text: string): Promise<void> {
    this.unsupported('typeText', 'element(matcher).typeText(text)');
  }

  async clearText(_target: Selector): Promise<void> {
    this.unsupported('clearText', 'element(matcher).clearText()');
  }

  async pressKey(_key: DriverKey): Promise<void> {
    this.unsupported('pressKey', 'platform key APIs / device.pressBack()');
  }

  async scroll(
    _target: Selector,
    _direction: ScrollDirection,
    _amount?: number
  ): Promise<void> {
    this.unsupported('scroll', 'element(matcher).scroll(amount, direction)');
  }

  async navigateBack(): Promise<void> {
    this.unsupported('navigateBack', 'device.pressBack()');
  }

  async waitFor(
    _target: Selector,
    _state: WaitState,
    _options?: WaitOptions
  ): Promise<void> {
    this.unsupported(
      'waitFor',
      'waitFor(element(matcher)).toBeVisible() / not.toBeVisible()'
    );
  }

  async isVisible(_target: Selector): Promise<boolean> {
    this.unsupported('isVisible', 'expect(element(matcher)).toBeVisible()');
  }

  async getText(_target: Selector): Promise<string | null> {
    this.unsupported('getText', 'Detox has no first-class text read-back API');
  }

  private unsupported(operation: string, mapping: string): never {
    throw new NotImplementedError(this.kind, operation, mapping);
  }
}
