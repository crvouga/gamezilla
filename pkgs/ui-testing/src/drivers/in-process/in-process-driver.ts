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
import { ElementNotFoundError, NotImplementedError } from '../../core/errors';
import { DRIVER_KEY_TO_DOM, type DriverKey } from '../../core/keys';
import { type WaitPollOptions, waitUntil } from '../../core/wait';
import type {
  Driver,
  ScrollDirection,
  TapPosition,
  WaitState,
} from '../../driver/driver';
import { formatSelector } from '../../selector/format';
import type { Selector } from '../../selector/selector';
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
  private readonly now: () => number;
  private readonly timers: Timers;
  private context: TContext | undefined;
  private app: RenderedApp | undefined;

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

  async tap(target: Selector): Promise<void> {
    await this.activate();
    await this.requireApp().tap(await this.requireElement(target));
  }

  async tapAt(target: Selector, position: TapPosition): Promise<void> {
    await this.activate();
    await this.requireApp().tapAt(await this.requireElement(target), position);
  }

  async input(target: Selector, text: string): Promise<void> {
    await this.activate();
    await this.requireApp().typeText(await this.requireElement(target), text);
  }

  async clear(target: Selector): Promise<void> {
    await this.activate();
    await this.requireApp().clearText(await this.requireElement(target));
  }

  async key(key: DriverKey): Promise<void> {
    await this.activate();
    await this.requireApp().pressKey(DRIVER_KEY_TO_DOM[key]);
  }

  async scroll(
    target: Selector,
    direction: ScrollDirection,
    amount = 100
  ): Promise<void> {
    await this.activate();
    await this.requireApp().scroll(
      await this.requireElement(target),
      direction,
      amount
    );
  }

  async back(): Promise<void> {
    throw new NotImplementedError(
      this.kind,
      'navigateBack',
      'Provide app-level back handling via a page object or harness helper'
    );
  }

  async wait(
    target: Selector,
    state: WaitState,
    options?: WaitPollOptions
  ): Promise<void> {
    const description =
      options?.description ?? `${state} ${formatSelector(target)}`;
    await waitUntil(
      async () => {
        // Flush pending React updates before each poll (AuthBridge / sync).
        await this.activate();
        const visible = await this.isVisible(target);
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

  async expectVisible(
    target: Selector,
    options?: AssertionOptions
  ): Promise<void> {
    await runExpectVisible(this, target, options);
  }

  async expectHidden(
    target: Selector,
    options?: AssertionOptions
  ): Promise<void> {
    await runExpectHidden(this, target, options);
  }

  async expectText(
    target: Selector,
    expected: string,
    options?: AssertionOptions & { exact?: boolean }
  ): Promise<void> {
    await runExpectText(this, target, expected, options);
  }

  async isVisible(target: Selector): Promise<boolean> {
    const app = this.requireApp();
    const element = app.query(target);
    if (!element) {
      return false;
    }
    return app.isVisible(element);
  }

  async getText(target: Selector): Promise<string | null> {
    const app = this.requireApp();
    return app.getText(await this.requireElement(target));
  }

  async snapshotHtml(options?: {
    readonly stylesheetHref?: string;
  }): Promise<string | null> {
    const app = this.app;
    if (!app?.snapshotHtml) return null;
    return app.snapshotHtml(
      options?.stylesheetHref !== undefined
        ? { stylesheetHref: options.stylesheetHref }
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

  private async requireElement(target: Selector): Promise<HostNode> {
    const element = this.requireApp().query(target);
    if (!element) {
      throw new ElementNotFoundError(formatSelector(target));
    }
    return element;
  }
}
