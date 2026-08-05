import { ElementNotFoundError, NotImplementedError } from '../../core/errors';
import { DRIVER_KEY_TO_DOM, type DriverKey } from '../../core/keys';
import { waitUntil, type WaitOptions } from '../../core/wait';
import type { AppHarness } from '../../bootstrap/app-harness';
import type {
  RenderAdapter,
  RenderedApp,
} from '../../bootstrap/render-adapter';
import type {
  Driver,
  ScrollDirection,
  TapPosition,
  WaitState,
} from '../../driver/driver';
import { formatSelector } from '../../selector/format';
import type { Selector } from '../../selector/selector';
import { createDomRenderAdapter } from './renderer-dom';

export type InProcessDriverOptions<TContext = void> = {
  harness: AppHarness<TContext>;
  /** Defaults to the shipped react-native-web DOM renderer. */
  renderer?: RenderAdapter;
};

/**
 * Boots an application entirely in-process via a {@link RenderAdapter}.
 * No browser, emulator, IPC, or HTTP server.
 */
export class InProcessDriver<TContext = void> implements Driver {
  readonly kind = 'in-process';

  private readonly harness: AppHarness<TContext>;
  private readonly renderer: RenderAdapter;
  private context: TContext | undefined;
  private app: RenderedApp | undefined;

  constructor(options: InProcessDriverOptions<TContext>) {
    this.harness = options.harness;
    this.renderer = options.renderer ?? createDomRenderAdapter();
  }

  async launch(): Promise<void> {
    await this.close();
    this.context = this.harness.setup
      ? await this.harness.setup()
      : (undefined as TContext);
    const root = this.harness.createRoot(this.context as TContext);
    this.app = await this.renderer.render(root);
  }

  async close(): Promise<void> {
    this.app?.unmount();
    this.app = undefined;
    if (this.harness.teardown && this.context !== undefined) {
      await this.harness.teardown(this.context);
    }
    this.context = undefined;
  }

  async tap(target: Selector): Promise<void> {
    await this.requireApp().tap(await this.requireElement(target));
  }

  async tapAt(target: Selector, position: TapPosition): Promise<void> {
    await this.requireApp().tapAt(await this.requireElement(target), position);
  }

  async typeText(target: Selector, text: string): Promise<void> {
    await this.requireApp().typeText(await this.requireElement(target), text);
  }

  async clearText(target: Selector): Promise<void> {
    await this.requireApp().clearText(await this.requireElement(target));
  }

  async pressKey(key: DriverKey): Promise<void> {
    await this.requireApp().pressKey(DRIVER_KEY_TO_DOM[key]);
  }

  async scroll(
    target: Selector,
    direction: ScrollDirection,
    amount = 100
  ): Promise<void> {
    await this.requireApp().scroll(
      await this.requireElement(target),
      direction,
      amount
    );
  }

  async navigateBack(): Promise<void> {
    throw new NotImplementedError(
      this.kind,
      'navigateBack',
      'Provide app-level back handling via a page object or harness helper'
    );
  }

  async waitFor(
    target: Selector,
    state: WaitState,
    options?: WaitOptions
  ): Promise<void> {
    const description =
      options?.description ?? `${state} ${formatSelector(target)}`;
    await waitUntil(
      async () => {
        const visible = await this.isVisible(target);
        return state === 'visible' ? visible : !visible;
      },
      { ...options, description }
    );
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

  private requireApp(): RenderedApp {
    if (!this.app) {
      throw new Error('Driver not launched. Call launch() first.');
    }
    return this.app;
  }

  private async requireElement(target: Selector): Promise<Element> {
    const element = this.requireApp().query(target);
    if (!element) {
      throw new ElementNotFoundError(formatSelector(target));
    }
    return element;
  }
}
