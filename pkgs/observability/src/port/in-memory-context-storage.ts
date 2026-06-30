import type { SpanContext } from '../shared/types';
import type { SpanContextStorage } from './observability';

export class InMemorySpanContextStorage implements SpanContextStorage {
  private current: SpanContext | undefined;

  active(): SpanContext | undefined {
    return this.current;
  }

  runWith<T>(ctx: SpanContext, fn: () => T): T {
    const prev = this.current;
    this.current = ctx;
    try {
      return fn();
    } finally {
      this.current = prev;
    }
  }

  async runWithAsync<T>(ctx: SpanContext, fn: () => Promise<T>): Promise<T> {
    const prev = this.current;
    this.current = ctx;
    try {
      return await fn();
    } finally {
      this.current = prev;
    }
  }
}
