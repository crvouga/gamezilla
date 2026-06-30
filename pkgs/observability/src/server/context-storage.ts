import { AsyncLocalStorage } from 'node:async_hooks';
import type { SpanContext } from '../shared/types';
import type { SpanContextStorage } from '../port/observability';

const als = new AsyncLocalStorage<SpanContext>();

export function createAsyncLocalSpanContextStorage(): SpanContextStorage {
  return {
    active(): SpanContext | undefined {
      return als.getStore();
    },
    runWith<T>(ctx: SpanContext, fn: () => T): T {
      return als.run(ctx, fn);
    },
    async runWithAsync<T>(ctx: SpanContext, fn: () => Promise<T>): Promise<T> {
      return await als.run(ctx, fn);
    },
  };
}

export function getActiveSpanContextFromAls(): SpanContext | undefined {
  return als.getStore();
}
