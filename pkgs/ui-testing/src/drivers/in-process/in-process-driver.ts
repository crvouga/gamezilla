import type { Timers } from '@pkgs/clock';
import {
  type AssertionOptions,
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
import { ElementNotFoundError } from '../../core/errors';
import { DRIVER_KEY_TO_DOM, type DriverKey } from '../../core/keys';
import { type WaitPollOptions, waitUntil } from '../../core/wait';
import type {
  Driver,
  ScrollDirection,
  TapPosition,
  UiWaitOptions,
  WaitState,
} from '../../driver/driver';
import { formatTestId } from '../../selector/format';
import { createRntlRenderAdapter } from './renderer-rntl';

export type InProcessDriverOptions<TContext = void> = {
  harness: AppHarness<TContext>;
  /** Defaults to the shipped React Native Testing Library renderer. */
  renderer?: RenderAdapter;
  readonly now: () => number;
  readonly timers: Timers;
};

/**
 * Boots an application entirely in-process via a {@link RenderAdapter}
 * (or a harness-owned {@link AppHarness.mount}).
 * No browser, emulator, IPC, or HTTP server.
 */
export class InProcessDriver<TContext = void> implements Driver {
  readonly kind = 'in-process';

  private readonly harness: AppHarness<TContext>;
  private readonly renderer: RenderAdapter;
  readonly now: () => number;
  readonly timers: Timers;
  private context: TContext | undefined;
  private app: RenderedApp | undefined;

  readonly expect: Driver['expect'] = {
    visible: (testId, options) => this.expectVisible(testId, options),
    hidden: (testId, options) => this.expectHidden(testId, options),
    text: (testId, expected, options) =>
      this.expectText(testId, expected, options),
  };

  constructor(options: InProcessDriverOptions<TContext>) {
    this.harness = options.harness;
    this.renderer = options.renderer ?? createRntlRenderAdapter();
    this.now = options.now;
    this.timers = options.timers;
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
        'AppHarness must provide createRoot() or mount() for in-process launch'
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
    await this.waitVisible(testId, options);
    await this.activate();
    await this.requireApp().tap(await this.requireElement(testId));
  }

  async tapAt(testId: string, position: TapPosition): Promise<void> {
    await this.waitVisible(testId);
    await this.activate();
    await this.requireApp().tapAt(await this.requireElement(testId), position);
  }

  async input(
    testId: string,
    text: string,
    options?: UiWaitOptions
  ): Promise<void> {
    await this.waitVisible(testId, options);
    await this.activate();
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
    state: WaitState,
    options?: WaitPollOptions
  ): Promise<void> {
    const description =
      options?.description ?? `${state} ${formatTestId(testId)}`;
    await waitUntil(
      async () => {
        // Flush pending React updates before each poll (AuthBridge / sync).
        await this.activate();
        const visible = await this.isVisible(testId);
        return state === 'visible' ? visible : !visible;
      },
      {
        ...options,
        description,
        now: this.now,
        timers: this.timers,
      }
    );
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

  private async activate(): Promise<void> {
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
