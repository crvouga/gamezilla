import { expect } from 'bun:test';
import type { Host, Ports, Run } from '../../index';
import { start, walk } from '../../index';
import { replay } from '../../pbt';
import type { Page } from './page';
import {
  COUNTER_ACTIONS,
  COUNTER_PROPERTIES,
  type CounterSurface,
  count,
  counter,
  decrement,
  increment,
  leaveSettings,
  openSettings,
  reset,
  route,
  setStep,
} from './scenario';

export type CounterHost = Host<
  Ports & { readonly openPage: () => Promise<Page> }
>;

/**
 * BDD-style domain driver over a DST {@link Run} — same idea as
 * `@sim/test` {@link AppDriver}: scenarios speak product verbs, not
 * `run.apply` / `run.observe`.
 */
export class CounterApp implements AsyncDisposable {
  private constructor(private readonly run: Run<CounterSurface>) {}

  static async open(args: {
    readonly host: CounterHost;
    readonly seed?: number;
  }): Promise<CounterApp> {
    const run = await start(counter, {
      host: args.host,
      seed: args.seed ?? 1,
      properties: COUNTER_PROPERTIES,
    });
    return new CounterApp(run);
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.run[Symbol.asyncDispose]();
  }

  // --- home ------------------------------------------------------------------

  async increment(): Promise<void> {
    await this.run.apply(increment);
  }

  async decrement(): Promise<void> {
    await this.run.apply(decrement);
  }

  async openSettings(): Promise<void> {
    await this.run.apply(openSettings);
  }

  async openResetAndConfirm(): Promise<void> {
    await this.run.apply(reset);
  }

  // --- settings --------------------------------------------------------------

  async setStep(n: 1 | 5 | 10): Promise<void> {
    await this.run.apply(setStep, n);
  }

  async leaveSettings(): Promise<void> {
    await this.run.apply(leaveSettings);
  }

  // --- expectations ----------------------------------------------------------

  async expectCount(n: number): Promise<void> {
    expect(await this.run.observe(count)).toBe(n);
  }

  async expectRoute(name: string): Promise<void> {
    expect(await this.run.observe(route)).toBe(name);
  }

  async expectDecrementDisabled(): Promise<void> {
    const { ActionNotEnabled } = await import('../../index');
    await expect(this.run.apply(decrement)).rejects.toBeInstanceOf(
      ActionNotEnabled
    );
  }

  async expectResetDisabled(): Promise<void> {
    const { ActionNotEnabled } = await import('../../index');
    await expect(this.run.apply(reset)).rejects.toBeInstanceOf(
      ActionNotEnabled
    );
  }

  // --- exploration -----------------------------------------------------------

  async exploreAndReplay(args: {
    readonly host: CounterHost;
    readonly steps?: number;
  }): Promise<void> {
    const w = await walk(this.run, {
      actions: COUNTER_ACTIONS,
      steps: args.steps ?? 12,
    });
    expect(w.violations).toEqual([]);
    expect(w.choices.length).toBeGreaterThan(0);
    await replay(counter, w, {
      host: args.host,
      properties: COUNTER_PROPERTIES,
      actions: COUNTER_ACTIONS,
    });
  }
}
