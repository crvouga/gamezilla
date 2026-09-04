import type { DriverKey } from '@pkgs/ui-testing/core/keys';
import type {
  AssertionOptions,
  DriverNode,
  DriverWaitOptions,
  ElementLayout,
  ScrollDirection,
  TapPosition,
  UiWaitOptions,
  WaitState,
  WaitTextCondition,
} from '@pkgs/ui-testing/driver/driver';

export type DetoxDriverNodeHost = {
  unsupported(operation: string, mapping: string): never;
};

/** Locator node for {@link DetoxDriver} — resolves a testId path at action time. */
export class DetoxDriverNode implements DriverNode {
  readonly expect: DriverNode['expect'] = {
    visible: (options) => this.expectVisible(options),
    hidden: (options) => this.expectHidden(options),
    text: (expected, options) => this.expectText(expected, options),
  };

  constructor(
    private readonly driver: DetoxDriverNodeHost,
    private readonly path: readonly string[]
  ) {}

  get(testId: string): DriverNode {
    return new DetoxDriverNode(this.driver, [...this.path, testId]);
  }

  async tap(_options?: UiWaitOptions): Promise<void> {
    this.driver.unsupported('tap', 'element(matcher).tap()');
  }

  async tapAt(_position: TapPosition): Promise<void> {
    this.driver.unsupported('tapAt', 'element(matcher).tap({ x, y })');
  }

  async drag(_from: TapPosition, _to: TapPosition): Promise<void> {
    this.driver.unsupported(
      'drag',
      'element(matcher).longPressAndDrag(duration, x, y, target)'
    );
  }

  async layout(): Promise<ElementLayout | null> {
    this.driver.unsupported('layout', 'element(matcher).getAttributes()');
  }

  async input(_text: string, _options?: UiWaitOptions): Promise<void> {
    this.driver.unsupported('typeText', 'element(matcher).typeText(text)');
  }

  async clear(): Promise<void> {
    this.driver.unsupported('clearText', 'element(matcher).clearText()');
  }

  async key(_key: DriverKey): Promise<void> {
    this.driver.unsupported('pressKey', 'platform key APIs');
  }

  async scroll(_direction: ScrollDirection, _amount?: number): Promise<void> {
    this.driver.unsupported(
      'scroll',
      'element(matcher).scroll(amount, direction)'
    );
  }

  async wait(
    _state: WaitState | WaitTextCondition,
    _options?: DriverWaitOptions
  ): Promise<void> {
    this.driver.unsupported(
      'wait',
      'waitFor(element(matcher)).toBeVisible() / not.toBeVisible()'
    );
  }

  async isVisible(): Promise<boolean> {
    this.driver.unsupported(
      'isVisible',
      'expect(element(matcher)).toBeVisible()'
    );
  }

  async text(): Promise<string | null> {
    this.driver.unsupported(
      'text',
      'Detox has no first-class text read-back API'
    );
  }

  private async expectVisible(_options?: AssertionOptions): Promise<void> {
    this.driver.unsupported(
      'expect.visible',
      'waitFor(element(matcher)).toBeVisible()'
    );
  }

  private async expectHidden(_options?: AssertionOptions): Promise<void> {
    this.driver.unsupported(
      'expect.hidden',
      'waitFor(element(matcher)).not.toBeVisible()'
    );
  }

  private async expectText(
    _expected: string,
    _options?: AssertionOptions & { exact?: boolean }
  ): Promise<void> {
    this.driver.unsupported(
      'expect.text',
      'Detox has no first-class text read-back API'
    );
  }
}

export function createDetoxDriverNode(
  host: DetoxDriverNodeHost,
  testId: string
): DriverNode {
  return new DetoxDriverNode(host, [testId]);
}
