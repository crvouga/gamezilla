import type { Timers } from '@pkgs/clock';

import type { ReportBucket } from './types';

export type SseSend = (event: string, data: unknown) => void;

export type BucketSubscription = {
  readonly id: number;
  readonly bucketId: string;
  /** Nav run id; may be `latest`. */
  readonly runId: string | null;
  readonly testId: string | null;
  readonly send: SseSend;
};

export type GlobalSubscription = {
  readonly id: number;
  readonly send: SseSend;
};

/**
 * In-memory SSE fan-out for report buckets + global bucket list.
 */
export class SseHub {
  private nextId = 1;
  private readonly byBucket = new Map<string, Set<BucketSubscription>>();
  private readonly global = new Set<GlobalSubscription>();

  subscribeGlobal(send: SseSend): GlobalSubscription {
    const sub: GlobalSubscription = { id: this.nextId++, send };
    this.global.add(sub);
    return sub;
  }

  unsubscribeGlobal(sub: GlobalSubscription): void {
    this.global.delete(sub);
  }

  subscribeBucket(
    bucketId: string,
    interest: {
      readonly runId: string | null;
      readonly testId: string | null;
      readonly send: SseSend;
    }
  ): BucketSubscription {
    const sub: BucketSubscription = {
      id: this.nextId++,
      bucketId,
      runId: interest.runId,
      testId: interest.testId,
      send: interest.send,
    };
    let set = this.byBucket.get(bucketId);
    if (!set) {
      set = new Set();
      this.byBucket.set(bucketId, set);
    }
    set.add(sub);
    return sub;
  }

  unsubscribeBucket(sub: BucketSubscription): void {
    const set = this.byBucket.get(sub.bucketId);
    if (!set) return;
    set.delete(sub);
    if (set.size === 0) this.byBucket.delete(sub.bucketId);
  }

  bucketSubscribers(bucketId: string): readonly BucketSubscription[] {
    return [...(this.byBucket.get(bucketId) ?? [])];
  }

  broadcastBuckets(buckets: readonly ReportBucket[]): void {
    const payload = buckets.map((b) => ({ id: b.id, label: b.label }));
    for (const sub of this.global) {
      sub.send('buckets', payload);
    }
  }
}

const TEXT_ENCODER = new TextEncoder();

export function encodeSse(event: string, data: unknown): Uint8Array {
  return TEXT_ENCODER.encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  );
}

export function encodeSseComment(comment: string): Uint8Array {
  return TEXT_ENCODER.encode(`: ${comment}\n\n`);
}

export type SseStreamHandles = {
  readonly response: Response;
  readonly send: SseSend;
  readonly close: () => void;
};

/** ReadableStream SSE response; caller registers/unregisters on open/cancel. */
export function openSseStream(args: {
  readonly onStart: (send: SseSend) => void;
  readonly onCancel: () => void;
  readonly timers: Timers;
  readonly heartbeatMs?: number;
}): SseStreamHandles {
  const heartbeatMs = args.heartbeatMs ?? 5_000;
  const { timers } = args;
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let heartbeat: unknown = null;
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    if (heartbeat != null) timers.clearInterval(heartbeat);
    heartbeat = null;
    try {
      controller?.close();
    } catch {
      /* already closed */
    }
    controller = null;
    args.onCancel();
  };

  const send: SseSend = (event, data) => {
    if (closed || controller == null) return;
    try {
      controller.enqueue(encodeSse(event, data));
    } catch {
      close();
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
      args.onStart(send);
      heartbeat = timers.setInterval(() => {
        if (closed || controller == null) return;
        try {
          controller.enqueue(encodeSseComment('ping'));
        } catch {
          close();
        }
      }, heartbeatMs);
    },
    cancel() {
      close();
    },
  });

  const response = new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });

  return { response, send, close };
}
