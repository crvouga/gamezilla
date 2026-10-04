import type { Clock } from '@pkgs/clock-shared/types';
import type { Driver, DriverNode } from '@pkgs/ui-testing-root-shared/driver';
import type { DriverKey } from '@pkgs/ui-testing-root-shared/keys';
import { DRIVER_KEY_TO_DOM } from '@pkgs/ui-testing-root-shared/keys';
import type { RenderedApp } from '@pkgs/ui-testing-root-shared/render-adapter';
import type { JSX } from 'solid-js';
import type { LayoutProvider } from './dom-layout';
import type { WaitPump } from './dom-wait';
import { DEFAULT_WAIT_TIMEOUT_MS, microtaskPump } from './dom-wait';
import { mountSolidApp } from './mount-solid-app';
import { SolidDomDriverNode } from './solid-dom-driver-node';

/**
 * Application-supplied bootstrap for the solid-dom driver. Provide either
 * {@link createRoot} (mounted by the driver into a fresh container) or
 * {@link mount} (harness owns the mount, e.g. a multi-actor session facade).
 */
export type SolidAppHarness<TContext = void> = {
  /** Optional one-time setup before the root mounts. */
  readonly setup?: (() => Promise<TContext>) | undefined;
  /** Solid component for the application root (providers and all). */
  readonly createRoot?: ((ctx: TContext) => () => JSX.Element) | undefined;
  /** Own the mount; takes precedence over {@link createRoot}. */
  readonly mount?: ((ctx: TContext) => Promise<RenderedApp>) | undefined;
  /** Optional teardown after `close()`. */
  readonly teardown?: ((ctx: TContext) => Promise<void>) | undefined;
};

export type SolidDomDriverOptions<TContext = void> = {
  readonly harness: SolidAppHarness<TContext>;
  /** Deadline clock for waits — wall, or a virtual clock the pump advances. */
  readonly clock: Clock;
  /**
   * Drives product work between wait checks (the harness's `runFor(0)`).
   * Defaults to a microtask flush — enough for synchronous Solid updates.
   */
  readonly pump?: WaitPump | undefined;
  /** Default `wait` / `expect` timeout. Default 5000. */
  readonly defaultTimeoutMs?: number | undefined;
  /** DOM document to mount into; defaults to the global `document`. */
  readonly document?: Document | undefined;
  /** Layout synthesis for coordinate gestures on unmeasured hosts. */
  readonly layoutProvider?: LayoutProvider | undefined;
};

function requireGlobalDocument(): Document {
  if (typeof document === 'undefined') {
    throw new Error(
      'solid-dom: no global document — pass `document` (happy-dom) explicitly'
    );
  }
  return document;
}

/**
 * Drives a Solid tree rendered into happy-dom (or any DOM). No browser,
 * emulator, IPC, or HTTP server. Waits are `MutationObserver` + pump driven,
 * never timer polling.
 */
export class SolidDomDriver<TContext = void> implements Driver {
  readonly kind = 'solid-dom';
  readonly clock: Clock;
  readonly pump: WaitPump;
  readonly defaultTimeoutMs: number;
  readonly document: Document;

  private readonly harness: SolidAppHarness<TContext>;
  private readonly layoutProvider: LayoutProvider | undefined;
  private context: TContext | undefined;
  private app: RenderedApp | undefined;

  constructor(options: SolidDomDriverOptions<TContext>) {
    this.harness = options.harness;
    this.clock = options.clock;
    this.pump = options.pump ?? microtaskPump;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS;
    this.document = options.document ?? requireGlobalDocument();
    this.layoutProvider = options.layoutProvider;
  }

  async launch(): Promise<void> {
    await this.close();
    const ctx = (
      this.harness.setup ? await this.harness.setup() : undefined
    ) as TContext;
    this.context = ctx;
    if (this.harness.mount) {
      this.app = await this.harness.mount(ctx);
    } else if (this.harness.createRoot) {
      this.app = mountSolidApp(this.harness.createRoot(ctx), {
        document: this.document,
        layoutProvider: this.layoutProvider,
      });
    } else {
      throw new Error(
        'SolidAppHarness must provide createRoot() or mount() for launch'
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
    return new SolidDomDriverNode(this, [testId]);
  }

  async key(key: DriverKey): Promise<void> {
    await this.activate();
    await this.requireApp().pressKey(DRIVER_KEY_TO_DOM[key]);
  }

  snapshotHtml(options?: {
    readonly stylesheetHref?: string;
  }): Promise<string | null> {
    const app = this.app;
    if (!app?.snapshotHtml) return Promise.resolve(null);
    return Promise.resolve(
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

  /** Focus this actor's tree when it belongs to a multi-actor session. */
  async activate(): Promise<void> {
    await this.requireApp().activate?.();
  }
}

export function createSolidDomDriver<TContext = void>(
  options: SolidDomDriverOptions<TContext>
): SolidDomDriver<TContext> {
  return new SolidDomDriver(options);
}
