import type { CrashHandler } from './crash-handler/crash-handler';
import { BrowserCrashHandler } from './crash-handler/crash-handler-browser';
import { FallbackCrashHandler } from './crash-handler/crash-handler-default';
import { NodeCrashHandler } from './crash-handler/crash-handler-node';

/** Registered from `singleton.ts`: Node exit, browser overlay, else uncatchable throw. */
export class DefaultCrashHandler implements CrashHandler {
  readonly priority = 100;

  private readonly node = new NodeCrashHandler();
  private readonly browser = new BrowserCrashHandler();
  private readonly fallback = new FallbackCrashHandler();

  match(): boolean {
    return true;
  }

  crash(message: string, context?: Record<string, unknown>): void {
    if (this.node.match()) {
      this.node.crash(message, context);
      return;
    }
    if (this.browser.match()) {
      this.browser.crash(message, context);
      return;
    }
    this.fallback.crash(message, context);
  }
}
