import { NotImplementedError } from '../../core/errors';
import type { DriverKey } from '../../core/keys';
import type { Driver, DriverNode } from '../../driver/driver';
import { createDetoxDriverNode } from './detox-driver-node';

/**
 * Minimal structural surface of Detox that a real implementation would use.
 * No `detox` package dependency — consumers inject their device/by matchers.
 *
 * Mapping (for a future full implementation):
 * - testId → `by.id(value)`
 * - nested get → `element(by.id(parent)).withDescendant(by.id(child))`
 * - tap → `element(matcher).tap()` (after wait-until-visible)
 * - tapAt → `element(matcher).tap({ x, y })` (absolute coords from ratios)
 * - typeText → `element(matcher).typeText(text)` (after wait-until-visible)
 * - clearText → `element(matcher).clearText()`
 * - pressKey → platform key APIs (limited)
 * - scroll → `element(matcher).scroll(amount, direction)`
 * - wait visible → `waitFor(element(matcher)).toBeVisible()`
 * - wait hidden → `waitFor(element(matcher)).not.toBeVisible()`
 * - wait text → unsupported in classic Detox (no text read-back API)
 * - text → **unsupported** in classic Detox (no text read-back API)
 */
export type DetoxLike = {
  device: {
    launchApp: (params?: Record<string, unknown>) => Promise<void>;
    terminateApp: () => Promise<void>;
    pressBack: () => Promise<void>;
  };
};

export type DetoxDriverOptions = {
  detox: DetoxLike;
};

/**
 * Stub Detox driver. Satisfies {@link Driver} so the architecture is proven;
 * every node operation throws {@link NotImplementedError} until a real Detox
 * integration is wired by a consumer who owns the Detox dependency.
 */
export class DetoxDriver implements Driver {
  readonly kind = 'detox';

  // Reserved for the future implementation that will call into Detox.
  constructor(_options: DetoxDriverOptions) {
    void _options;
  }

  async launch(): Promise<void> {
    this.unsupported('launch', 'device.launchApp()');
  }

  async close(): Promise<void> {
    this.unsupported('close', 'device.terminateApp()');
  }

  get(testId: string): DriverNode {
    return createDetoxDriverNode(this, testId);
  }

  async key(_key: DriverKey): Promise<void> {
    this.unsupported('pressKey', 'platform key APIs');
  }

  async snapshotHtml(): Promise<string | null> {
    return null;
  }

  unsupported(operation: string, mapping: string): never {
    throw new NotImplementedError(this.kind, operation, mapping);
  }
}
