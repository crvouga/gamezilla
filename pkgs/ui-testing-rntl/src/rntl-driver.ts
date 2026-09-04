import type { Timers } from '@pkgs/clock';
import type { AppHarness } from '@pkgs/ui-testing/bootstrap/app-harness';
import type {
  RenderAdapter,
  RenderedApp,
} from '@pkgs/ui-testing/bootstrap/render-adapter';
import { DRIVER_KEY_TO_DOM, type DriverKey } from '@pkgs/ui-testing/core/keys';
import type { WaitPump } from '@pkgs/ui-testing/core/wait';
import type { Driver, DriverNode } from '@pkgs/ui-testing/driver/driver';
import { createRntlRenderAdapter } from './renderer-rntl';
import { RntlDriverNode } from './rntl-driver-node';

export type RntlDriverOptions<TContext = void> = {
  harness: AppHarness<TContext>;
  /** Defaults to the shipped React Native Testing Library renderer. */
  renderer?: RenderAdapter;
  readonly now: () => number;
  readonly timers: Timers;
  /**
   * Virtual-time / event drain between wait checks. When set, replaces the
   * default wall 50ms sleep. Constructor-only — not a {@link DriverNode.wait} option.
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

  get(testId: string): DriverNode {
    return new RntlDriverNode(this, [testId]);
  }

  async key(key: DriverKey): Promise<void> {
    await this.activate();
    await this.requireApp().pressKey(DRIVER_KEY_TO_DOM[key]);
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

  requireApp(): RenderedApp {
    if (!this.app) {
      throw new Error('Driver not launched. Call launch() first.');
    }
    return this.app;
  }

  /** Flush pending React / focus the active multi-app root. */
  async activate(): Promise<void> {
    await this.requireApp().activate?.();
  }
}
