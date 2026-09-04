import {
  runExpectHidden,
  runExpectText,
  runExpectVisible,
} from '@pkgs/ui-testing/assertions/driver-expect';
import type {
  HostNode,
  RenderedApp,
} from '@pkgs/ui-testing/bootstrap/render-adapter';
import {
  ElementNotFoundError,
  UiTestError,
} from '@pkgs/ui-testing/core/errors';
import { DRIVER_KEY_TO_DOM, type DriverKey } from '@pkgs/ui-testing/core/keys';
import { type WaitPump, waitUntil } from '@pkgs/ui-testing/core/wait';
import type {
  DriverNode,
  DriverWaitOptions,
  ElementLayout,
  ScrollDirection,
  TapPosition,
  UiWaitOptions,
  WaitState,
  WaitTextCondition,
} from '@pkgs/ui-testing/driver/driver';
import { isWaitTextCondition } from '@pkgs/ui-testing/driver/driver';
import { formatTestIdPath } from '@pkgs/ui-testing/selector/format';

export type RntlDriverNodeHost = {
  readonly now: () => number;
  readonly timers: import('@pkgs/clock').Timers;
  readonly pump: WaitPump | undefined;
  requireApp(): RenderedApp;
  activate(): Promise<void>;
};

/** Locator node for {@link RntlDriver} — resolves a testId path at action time. */
export class RntlDriverNode implements DriverNode {
  readonly expect: DriverNode['expect'] = {
    visible: (options) => runExpectVisible(this, options),
    hidden: (options) => runExpectHidden(this, options),
    text: (expected, options) => runExpectText(this, expected, options),
  };

  constructor(
    private readonly host: RntlDriverNodeHost,
    private readonly path: readonly string[]
  ) {}

  get(testId: string): DriverNode {
    return new RntlDriverNode(this.host, [...this.path, testId]);
  }

  async tap(options?: UiWaitOptions): Promise<void> {
    await this.waitVisible(options);
    await this.host.requireApp().tap(await this.requireElement());
  }

  async tapAt(position: TapPosition): Promise<void> {
    await this.waitVisible();
    await this.host.requireApp().tapAt(await this.requireElement(), position);
  }

  async drag(from: TapPosition, to: TapPosition): Promise<void> {
    await this.waitVisible();
    await this.host.requireApp().drag(await this.requireElement(), from, to);
  }

  async layout(): Promise<ElementLayout | null> {
    await this.host.activate();
    return this.host.requireApp().layout(await this.requireElement());
  }

  async input(text: string, options?: UiWaitOptions): Promise<void> {
    await this.waitVisible(options);
    await this.host.requireApp().typeText(await this.requireElement(), text);
  }

  async clear(): Promise<void> {
    await this.host.activate();
    await this.host.requireApp().clearText(await this.requireElement());
  }

  async key(key: DriverKey): Promise<void> {
    await this.host.activate();
    await this.host.requireApp().pressKey(DRIVER_KEY_TO_DOM[key]);
  }

  async scroll(direction: ScrollDirection, amount = 100): Promise<void> {
    await this.host.activate();
    await this.host
      .requireApp()
      .scroll(await this.requireElement(), direction, amount);
  }

  async wait(
    state: WaitState | WaitTextCondition,
    options?: DriverWaitOptions
  ): Promise<void> {
    if (isWaitTextCondition(state)) {
      await this.waitText(state, options);
      return;
    }
    await this.waitVisibility(state, options);
  }

  async isVisible(): Promise<boolean> {
    const element = this.queryElement();
    if (!element) return false;
    return this.host.requireApp().isVisible(element);
  }

  async text(): Promise<string | null> {
    return this.host.requireApp().getText(await this.requireElement());
  }

  private queryElement(): HostNode | null {
    const app = this.host.requireApp();
    if (this.path.length === 0) return null;
    let element = app.query(this.path[0] as string);
    if (!element) return null;
    for (let i = 1; i < this.path.length; i += 1) {
      const child = app.queryWithin(element, this.path[i] as string);
      if (!child) return null;
      element = child;
    }
    return element;
  }

  private async requireElement(): Promise<HostNode> {
    const element = this.queryElement();
    if (!element) {
      throw new ElementNotFoundError(formatTestIdPath(this.path));
    }
    return element;
  }

  private async waitVisibility(
    state: WaitState,
    options?: DriverWaitOptions
  ): Promise<void> {
    const description =
      options?.description ?? `${state} ${formatTestIdPath(this.path)}`;
    const pump = this.host.pump;
    if (pump !== undefined) {
      await this.host.activate();
    }
    await waitUntil(
      async () => {
        if (pump === undefined) {
          await this.host.activate();
        }
        const visible = await this.isVisible();
        return state === 'visible' ? visible : !visible;
      },
      {
        ...(options?.timeoutMs !== undefined
          ? { timeoutMs: options.timeoutMs }
          : {}),
        description,
        now: this.host.now,
        timers: this.host.timers,
        ...(pump !== undefined
          ? {
              pump: async () => {
                await pump();
                await this.host.activate();
              },
            }
          : {}),
      }
    );
  }

  private async waitText(
    state: WaitTextCondition,
    options?: DriverWaitOptions
  ): Promise<void> {
    const exact = state.exact !== false;
    const description =
      options?.description ??
      `text ${exact ? 'equals' : 'contains'} "${state.text}" on ${formatTestIdPath(this.path)}`;
    const pump = this.host.pump;
    if (pump !== undefined) {
      await this.host.activate();
    }

    let lastActual: string | null = null;
    try {
      await waitUntil(
        async () => {
          if (pump === undefined) {
            await this.host.activate();
          }
          lastActual = await this.text();
          return textMatches(lastActual, state.text, exact) ? true : null;
        },
        {
          ...(options?.timeoutMs !== undefined
            ? { timeoutMs: options.timeoutMs }
            : {}),
          description,
          now: this.host.now,
          timers: this.host.timers,
          ...(pump !== undefined
            ? {
                pump: async () => {
                  await pump();
                  await this.host.activate();
                },
              }
            : {}),
        }
      );
    } catch (error) {
      throw new UiTestError(
        `Expected text ${exact ? 'equals' : 'contains'} "${state.text}" on ${formatTestIdPath(this.path)}, got ${JSON.stringify(lastActual)}`,
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

function textMatches(
  actual: string | null,
  expected: string,
  exact: boolean
): boolean {
  return exact ? actual === expected : (actual?.includes(expected) ?? false);
}
