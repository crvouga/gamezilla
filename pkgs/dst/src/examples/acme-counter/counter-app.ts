import { expect } from 'bun:test';
import type { Script } from '../../index';
import {
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

/**
 * BDD-style domain driver over a DST {@link Script} — same idea as
 * `@sim/test` AppDriver: scenarios speak product verbs, not
 * `s.apply` / `s.observe`.
 */
export class CounterApp implements AsyncDisposable {
  private constructor(
    private readonly s: Script<CounterSurface>,
    private readonly hostName: string
  ) {}

  static async open(args: {
    readonly host: string;
    readonly seed?: number;
  }): Promise<CounterApp> {
    const s = await counter.script({
      host: args.host,
      seed: args.seed ?? 1,
    });
    return new CounterApp(s, args.host);
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.s[Symbol.asyncDispose]();
  }

  async increment(): Promise<void> {
    await this.s.apply(increment);
  }

  async decrement(): Promise<void> {
    await this.s.apply(decrement);
  }

  async openSettings(): Promise<void> {
    await this.s.apply(openSettings);
  }

  async openResetAndConfirm(): Promise<void> {
    await this.s.apply(reset);
  }

  async setStep(n: 1 | 5 | 10): Promise<void> {
    await this.s.apply(setStep, n);
  }

  async leaveSettings(): Promise<void> {
    await this.s.apply(leaveSettings);
  }

  async expectCount(n: number): Promise<void> {
    expect(await this.s.observe(count)).toBe(n);
  }

  async expectRoute(name: string): Promise<void> {
    expect(await this.s.observe(route)).toBe(name);
  }

  async expectDecrementDisabled(): Promise<void> {
    const { ActionNotEnabled } = await import('../../index');
    await expect(this.s.apply(decrement)).rejects.toBeInstanceOf(
      ActionNotEnabled
    );
  }

  async expectResetDisabled(): Promise<void> {
    const { ActionNotEnabled } = await import('../../index');
    await expect(this.s.apply(reset)).rejects.toBeInstanceOf(ActionNotEnabled);
  }

  async exploreAndReplay(args?: { readonly steps?: number }): Promise<void> {
    const w = await this.s.walk({
      steps: args?.steps ?? 12,
    });
    expect(w.violations).toEqual([]);
    expect(w.choices.length).toBeGreaterThan(0);
    await counter.replay(w, { host: this.hostName });
  }
}
