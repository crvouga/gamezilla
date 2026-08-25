import type { Timers } from '@pkgs/clock';
import {
  runExpectHidden,
  runExpectText,
  runExpectVisible,
} from '../../assertions/driver-expect';
import type { AppHarness } from '../../bootstrap/app-harness';
import type {
  HostNode,
  RenderAdapter,
  RenderedApp,
} from '../../bootstrap/render-adapter';
import { ElementNotFoundError, UiTestError } from '../../core/errors';
import { DRIVER_KEY_TO_DOM, type DriverKey } from '../../core/keys';
import { type WaitPump, waitUntil } from '../../core/wait';
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
import { isWaitTextCondition } from '../../driver/driver';
import { formatTestId } from '../../selector/format';
import { createRntlRenderAdapter } from './renderer-rntl';

export type RntlDriverOptions<TContext = void> = {
  harness: AppHarness<TContext>;
  /** Defaults to the shipped React Native Testing Library renderer. */
  renderer?: RenderAdapter;
  readonly now: () => number;
  readonly timers: Timers;
  /**
   * Virtual-time / event drain between wait checks. When set, replaces the
   * default wall 50ms sleep. Constructor-only — not a {@link Driver.wait} option.
   */
  readonly pump?: WaitPump;
};

/**
 * Boots an application via a {@link RenderAdapter} (RNTL)
 * or a harness-owned {@link AppHarness.mount}.
 * No browser, emulator, IPC, or HTTP server.
 *
 * Waits use an internal virtual-clock pump + React flush — not RNTL
 * `findBy` / `waitFor` (those wall-sleep ~50ms per miss).
 */
export class RntlDriver<TContext = void> implements Driver {
  readonly kind = 'rntl';

  private readonly harness: AppHarness<TContext>;
  private readonly renderer: RenderAdapter;
  readonly now: () => number;
  readonly timers: Timers;
  readonly pump: WaitPump | undefined;
  private context: TContext | undefined;
  private app: RenderedApp | undefined;

  readonly expect: Driver['expect'] = {
    visible: (testId, options) => this.expectVisible(testId, options),
    hidden: (testId, options) => this.expectHidden(testId, options),
    text: (testId, expected, options) =>
      this.expectText(testId, expected, options),
  };

  constructor(options: RntlDriverOptions<TContext>) {
    this.harness = options.harness;
    this.renderer = options.renderer ?? createRntlRenderAdapter();
    this.now = options.now;
    this.timers = options.timers;
    this.pump = options.pump;
  }

  async launch(): Promise<void> {
    await this.close();
    this.context = this.harness.setup
      ? await this.harness.setup()
      : (undefined as TContext);
    const ctx = this.context as TContext;
    if (this.harness.mount) {
      this.app = await this.harness.mount(ctx);
    } else if (this.harness.createRoot) {
      this.app = await this.renderer.render(this.harness.createRoot(ctx));
    } else {
      throw new Error(
        'AppHarness must provide createRoot() or mount() for rntl launch'
      );
    }
  }

  async close(): Promise<void> {
    await this.app?.unmount();
    this.app = undefined;
    if (this.harness.teardown && this.context !== undefined) {
      await this.harness.teardown(this.context);
    }
    this.context = undefined;
  }

  async tap(testId: string, options?: UiWaitOptions): Promise<void> {
    // wait() already flushed React; skip a spare activate before fireEvent.
    await this.waitVisible(testId, options);
    await this.requireApp().tap(await this.requireElement(testId));
  }

  async tapAt(testId: string, position: TapPosition): Promise<void> {
    await this.waitVisible(testId);
    await this.requireApp().tapAt(await this.requireElement(testId), position);
  }

  async input(
    testId: string,
    text: string,
    options?: UiWaitOptions
  ): Promise<void> {
    await this.waitVisible(testId, options);
    await this.requireApp().typeText(await this.requireElement(testId), text);
  }

  async clear(testId: string): Promise<void> {
    await this.activate();
    await this.requireApp().clearText(await this.requireElement(testId));
  }

  async key(key: DriverKey): Promise<void> {
    await this.activate();
    await this.requireApp().pressKey(DRIVER_KEY_TO_DOM[key]);
  }

  async scroll(
    testId: string,
    direction: ScrollDirection,
    amount = 100
  ): Promise<void> {
    await this.activate();
    await this.requireApp().scroll(
      await this.requireElement(testId),
      direction,
      amount
    );
  }

  async wait(
    testId: string,
    state: WaitState | WaitTextCondition,
    options?: DriverWaitOptions
  ): Promise<void> {
    if (isWaitTextCondition(state)) {
      await this.waitText(testId, state, options);
      return;
    }
    await this.waitVisibility(testId, state, options);
  }

  async isVisible(testId: string): Promise<boolean> {
    const app = this.requireApp();
    const element = app.query(testId);
    if (!element) {
      return false;
    }
    return app.isVisible(element);
  }

  async getText(testId: string): Promise<string | null> {
    const app = this.requireApp();
    return app.getText(await this.requireElement(testId));
  }

  async snapshotHtml(options?: {
    readonly stylesheetHref?: string;
  }): Promise<string | null> {
    const app = this.app;
    if (!app?.snapshotHtml) return null;
    return (
      app.snapshotHtml(
        options?.stylesheetHref !== undefined
          ? { stylesheetHref: options.stylesheetHref }
          : undefined
      ) ?? null
    );
  }

  private async waitVisibility(
    testId: string,
    state: WaitState,
    options?: DriverWaitOptions
  ): Promise<void> {
    const description =
      options?.description ?? `${state} ${formatTestId(testId)}`;
    const pump = this.pump;
    // With a drain pump: one activate up front, then read-only checks; pump
    // runs clock then activate between misses. Without a pump: flush only
    // inside the predicate so an already-true first check is one act.
    if (pump !== undefined) {
      await this.activate();
    }
    await waitUntil(
      async () => {
        if (pump === undefined) {
          await this.activate();
        }
        const visible = await this.isVisible(testId);
        return state === 'visible' ? visible : !visible;
      },
      {
        ...(options?.timeoutMs !== undefined
          ? { timeoutMs: options.timeoutMs }
          : {}),
        description,
        now: this.now,
        timers: this.timers,
        ...(pump !== undefined
          ? {
              pump: async () => {
                await pump();
                await this.activate();
              },
            }
          : {}),
      }
    );
  }

  private async waitText(
    testId: string,
    state: WaitTextCondition,
    options?: DriverWaitOptions
  ): Promise<void> {
    const exact = state.exact !== false;
    const description =
      options?.description ??
      `text ${exact ? 'equals' : 'contains'} "${state.text}" on ${formatTestId(testId)}`;
    const pump = this.pump;
    if (pump !== undefined) {
      await this.activate();
    }

    let lastActual: string | null = null;
    try {
      await waitUntil(
        async () => {
          if (pump === undefined) {
            await this.activate();
          }
          lastActual = await this.getText(testId);
          return textMatches(lastActual, state.text, exact) ? true : null;
        },
        {
          ...(options?.timeoutMs !== undefined
            ? { timeoutMs: options.timeoutMs }
            : {}),
          description,
          now: this.now,
          timers: this.timers,
          ...(pump !== undefined
            ? {
                pump: async () => {
                  await pump();
                  await this.activate();
                },
              }
            : {}),
        }
      );
    } catch (error) {
      throw new UiTestError(
        `Expected text ${exact ? 'equals' : 'contains'} "${state.text}" on ${formatTestId(testId)}, got ${JSON.stringify(lastActual)}`,
        { cause: error }
      );
    }
  }

  private async expectVisible(
    testId: string,
    options?: AssertionOptions
  ): Promise<void> {
    await runExpectVisible(this, testId, options);
  }

  private async expectHidden(
    testId: string,
    options?: AssertionOptions
  ): Promise<void> {
    await runExpectHidden(this, testId, options);
  }

  private async expectText(
    testId: string,
    expected: string,
    options?: AssertionOptions & { exact?: boolean }
  ): Promise<void> {
    await runExpectText(this, testId, expected, options);
  }

  private async waitVisible(
    testId: string,
    options?: UiWaitOptions
  ): Promise<void> {
    await this.wait(
      testId,
      'visible',
      options?.timeoutMs !== undefined
        ? { timeoutMs: options.timeoutMs }
        : undefined
    );
  }

  private requireApp(): RenderedApp {
    if (!this.app) {
      throw new Error('Driver not launched. Call launch() first.');
    }
    return this.app;
  }

  /** Flush pending React / focus the active multi-app root. */
  async activate(): Promise<void> {
    await this.requireApp().activate?.();
  }

  private async requireElement(testId: string): Promise<HostNode> {
    const element = this.requireApp().query(testId);
    if (!element) {
      throw new ElementNotFoundError(formatTestId(testId));
    }
    return element;
  }
}

function textMatches(
  actual: string | null,
  expected: string,
  exact: boolean
): boolean {
  return exact ? actual === expected : (actual?.includes(expected) ?? false);
}
