import type { Inspection } from '@libs/synthetic-population-shared-ts/inspection';

const WINDOW_MS = 5000;
const MAX_ACTIONS = 100;

/** Samples repeated durable telemetry; the realm still retains every recent UI action locally. */
export class UiActionSampling {
  private readonly actions = new Map<string, { atMs: number; count: number }>();
  record(action: Inspection['actions'][number]): number | null {
    if (action.outcome === 'failed') return 1;
    const key = `${action.action}:${action.outcome}`;
    const previous = this.actions.get(key);
    const elapsed = action.atMs - (previous?.atMs ?? action.atMs);
    this.actions.delete(key);
    if (previous !== undefined && elapsed >= 0 && elapsed < WINDOW_MS) {
      this.actions.set(key, { ...previous, count: previous.count + 1 });
      return null;
    }
    this.actions.set(key, { atMs: action.atMs, count: 0 });
    if (this.actions.size > MAX_ACTIONS)
      this.actions.delete(this.actions.keys().next().value!);
    return (previous?.count ?? 0) + 1;
  }
}
