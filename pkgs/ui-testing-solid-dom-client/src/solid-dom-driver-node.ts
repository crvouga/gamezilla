import type { Clock } from '@pkgs/clock-shared/types';
import type {
  DriverNode,
  DriverWaitOptions,
  ElementLayout,
  GestureOptions,
  ScrollDirection,
  TapPosition,
  UiWaitOptions,
  WaitState,
  WaitTextCondition,
} from '@pkgs/ui-testing-root-shared/driver';
import { isWaitTextCondition } from '@pkgs/ui-testing-root-shared/driver';
import {
  runExpectHidden,
  runExpectText,
  runExpectVisible,
} from '@pkgs/ui-testing-root-shared/driver-expect';
import { ElementNotFoundError } from '@pkgs/ui-testing-root-shared/element-not-found-error';
import { formatTestIdPath } from '@pkgs/ui-testing-root-shared/format';
import type { DriverKey } from '@pkgs/ui-testing-root-shared/keys';
import { DRIVER_KEY_TO_DOM } from '@pkgs/ui-testing-root-shared/keys';
import type {
  HostNode,
  RenderedApp,
} from '@pkgs/ui-testing-root-shared/render-adapter';
import { UiTestError } from '@pkgs/ui-testing-root-shared/ui-test-error';
import { textMatches } from './dom-text';
import type { WaitPump } from './dom-wait';
import { waitForDom } from './dom-wait';

/** What a node needs from its driver: the app port, waiting inputs, focus. */
export type SolidDomNodeHost = {
  readonly clock: Clock;
  readonly pump: WaitPump;
  readonly defaultTimeoutMs: number;
  readonly document: Document;
  requireApp(): RenderedApp;
  activate(): Promise<void>;
};

const DEFAULT_SCROLL_AMOUNT = 100;

/** Locator node for the solid-dom driver — resolves a testId path at action time. */
export class SolidDomDriverNode implements DriverNode {
  readonly expect: DriverNode['expect'] = {
    visible: (options) => runExpectVisible(this, options),
    hidden: (options) => runExpectHidden(this, options),
    text: (expected, options) => runExpectText(this, expected, options),
  };

  constructor(
    private readonly host: SolidDomNodeHost,
    private readonly path: readonly string[]
  ) {}

  get(testId: string): DriverNode {
    return new SolidDomDriverNode(this.host, [...this.path, testId]);
  }

  async tap(options?: UiWaitOptions): Promise<void> {
    await this.waitVisible(options);
    await this.host.requireApp().tap(this.requireElement());
  }

  async tapAt(position: TapPosition, options?: GestureOptions): Promise<void> {
    await this.waitVisible();
    await this.host
      .requireApp()
      .tapAt(this.requireElement(), position, options);
  }

  async drag(
    from: TapPosition,
    to: TapPosition,
    options?: GestureOptions
  ): Promise<void> {
    await this.waitVisible();
    await this.host.requireApp().drag(this.requireElement(), from, to, options);
  }

  async layout(): Promise<ElementLayout | null> {
    await this.host.activate();
    return this.host.requireApp().layout(this.requireElement());
  }

  async input(text: string, options?: UiWaitOptions): Promise<void> {
    await this.waitVisible(options);
    await this.host.requireApp().typeText(this.requireElement(), text);
  }

  async clear(): Promise<void> {
    await this.host.activate();
    await this.host.requireApp().clearText(this.requireElement());
  }

  async key(key: DriverKey): Promise<void> {
    await this.host.activate();
    await this.host
      .requireApp()
      .pressKey(DRIVER_KEY_TO_DOM[key], this.requireElement());
  }

  async scroll(
    direction: ScrollDirection,
    amount = DEFAULT_SCROLL_AMOUNT
  ): Promise<void> {
    await this.host.activate();
    await this.host
      .requireApp()
      .scroll(this.requireElement(), direction, amount);
  }

  async wait(
    state: WaitState | WaitTextCondition,
    options?: DriverWaitOptions
  ): Promise<void> {
    await this.host.activate();
    if (isWaitTextCondition(state)) {
      await this.waitText(state, options);
      return;
    }
    const description =
      options?.description ?? `${state} ${formatTestIdPath(this.path)}`;
    await this.waitUntil(
      () => (state === 'visible' ? this.visibleNow() : !this.visibleNow()),
      description,
      options?.timeoutMs
    );
  }

  /**
   * A parked actor's tree is detached, so a read focuses that screen first.
   * A checkpoint may have parked it since the last action on it.
   */
  async isVisible(): Promise<boolean> {
    await this.host.activate();
    return this.visibleNow();
  }

  async text(): Promise<string | null> {
    await this.host.activate();
    return this.host.requireApp().getText(this.requireElement());
  }

  async attribute(name: string): Promise<string | null> {
    await this.host.activate();
    return this.host.requireApp().getAttribute(this.requireElement(), name);
  }

  private visibleNow(): boolean {
    const element = this.queryElement();
    if (element === null) return false;
    return this.host.requireApp().isVisible(element);
  }

  /** Resolved host node for the path, or `null` when any segment misses. */
  private queryElement(): HostNode {
    const app = this.host.requireApp();
    const [first, ...rest] = this.path;
    if (first === undefined) return null;
    let element = app.query(first);
    for (const testId of rest) {
      if (element === null) return null;
      element = app.queryWithin(element, testId);
    }
    return element;
  }

  private requireElement(): HostNode {
    const element = this.queryElement();
    if (element === null) {
      throw new ElementNotFoundError(formatTestIdPath(this.path));
    }
    return element;
  }

  private waitUntil(
    check: () => boolean,
    description: string,
    timeoutMs: number | undefined
  ): Promise<void> {
    return waitForDom(check, {
      target: this.host.document.body,
      clock: this.host.clock,
      pump: this.host.pump,
      timeoutMs: timeoutMs ?? this.host.defaultTimeoutMs,
      description,
    });
  }

  private async waitText(
    state: WaitTextCondition,
    options?: DriverWaitOptions
  ): Promise<void> {
    const exact = state.exact !== false;
    const verb = exact ? 'equals' : 'contains';
    const where = formatTestIdPath(this.path);
    const description =
      options?.description ?? `text ${verb} "${state.text}" on ${where}`;
    let lastActual: string | null = null;
    const readText = (): string | null => {
      const element = this.queryElement();
      return element === null ? null : this.host.requireApp().getText(element);
    };
    try {
      await this.waitUntil(
        () => {
          lastActual = readText();
          return textMatches(lastActual, state.text, exact);
        },
        description,
        options?.timeoutMs
      );
    } catch (error) {
      throw new UiTestError(
        `Expected text ${verb} "${state.text}" on ${where}, got ${JSON.stringify(lastActual)}`,
        { cause: error }
      );
    }
  }

  private async waitVisible(options?: UiWaitOptions): Promise<void> {
    await this.wait(
      'visible',
      options?.timeoutMs !== undefined
        ? { timeoutMs: options.timeoutMs }
        : undefined
    );
  }
}
