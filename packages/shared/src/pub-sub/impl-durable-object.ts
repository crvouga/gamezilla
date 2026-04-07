import { InMemoryPubSub } from './impl-in-memory';
import type { Listener, PubSub, Unsubscribe } from './interface';

/**
 * Minimal DO stub shape. Avoids a hard dependency on `@cloudflare/workers-types`.
 */
export interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
}

/**
 * {@link PubSub} adapter that combines local (same-request) delivery with
 * cross-request broadcast via a Durable Object.
 *
 * - `publish` delivers to local subscribers AND notifies the DO to broadcast
 *   to other connected clients (SSE/WebSocket).
 * - `subscribe` / `next` operate on the in-memory instance for the current
 *   request context.
 *
 * The Durable Object class that receives the `/publish` requests and manages
 * WebSocket connections lives in the Worker entry point.
 */
export class DurableObjectPubSub implements PubSub {
  private readonly inMemory = new InMemoryPubSub();

  constructor(private readonly doStub: DurableObjectStub) {}

  publish(topic: string, message: unknown): void {
    this.inMemory.publish(topic, message);

    void this.doStub.fetch(
      new Request('http://do/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, message }),
      }),
    );
  }

  subscribe(topic: string, listener: Listener): Unsubscribe {
    return this.inMemory.subscribe(topic, listener);
  }

  next(topic: string): Promise<unknown> {
    return this.inMemory.next(topic);
  }
}
