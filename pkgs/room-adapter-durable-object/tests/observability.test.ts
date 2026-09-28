import { afterEach, describe, expect, test } from 'bun:test';
import { context, trace } from '@opentelemetry/api';
import { InMemorySpanExporter } from '@opentelemetry/sdk-trace-base';
import {
  ATTR,
  createWorkerTelemetry,
  type WorkerTelemetry,
} from '@pkgs/observability/worker';
import { gameRoomModule } from '@pkgs/room/harness';
import {
  createDurableObjectAdapter,
  type DurableObjectInstanceState,
  type DurableObjectKvStorage,
} from '@pkgs/room-adapter-durable-object';

const CONNECTION_TRACE_ID = '11111111111111111111111111111111';
const UPGRADE_TRACE_ID = '22222222222222222222222222222222';

class MemoryStorage implements DurableObjectKvStorage {
  private readonly values = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.values.get(key) as T | undefined;
  }

  async put(key: string, value: unknown): Promise<void>;
  async put(entries: Record<string, unknown>): Promise<void>;
  async put(
    keyOrEntries: string | Record<string, unknown>,
    value?: unknown
  ): Promise<void> {
    if (typeof keyOrEntries === 'string') {
      this.values.set(keyOrEntries, value);
      return;
    }
    for (const [key, entry] of Object.entries(keyOrEntries)) {
      this.values.set(key, entry);
    }
  }

  async delete(key: string): Promise<boolean> {
    return this.values.delete(key);
  }

  async list<T>(options?: {
    readonly prefix?: string;
  }): Promise<Map<string, T>> {
    const output = new Map<string, T>();
    for (const [key, value] of this.values) {
      if (options?.prefix === undefined || key.startsWith(options.prefix)) {
        output.set(key, value as T);
      }
    }
    return output;
  }
}

function createTestState(sockets: WebSocket[]): {
  readonly state: DurableObjectInstanceState;
  readonly scheduled: Promise<unknown>[];
  readonly drain: () => Promise<void>;
} {
  const scheduled: Promise<unknown>[] = [];
  return {
    state: {
      storage: new MemoryStorage(),
      acceptWebSocket: () => undefined,
      getWebSockets: () => sockets,
      blockConcurrencyWhile: (fn) => fn(),
      waitUntil: (promise) => scheduled.push(promise),
    },
    scheduled,
    drain: async () => {
      await Promise.all(scheduled);
    },
  };
}

let telemetry: WorkerTelemetry | null = null;

afterEach(async () => {
  await telemetry?.shutdown();
  telemetry = null;
  trace.disable();
  context.disable();
});

describe('room Durable Object observability', () => {
  test('continues upgrade context and reconnects hibernated message/error spans', async () => {
    const exporter = new InMemorySpanExporter();
    telemetry = createWorkerTelemetry({
      serviceName: 'room-test',
      serviceVersion: '1',
      environment: 'test',
      buildSha: 'test',
      exporter,
    });
    const closed: Array<{ readonly code: number; readonly reason: string }> =
      [];
    const socket = createHibernatedSocket(closed);
    const testState = createTestState([socket]);
    const RoomObject = createDurableObjectAdapter({
      modules: [gameRoomModule],
      clock: { now: () => 1 },
      createId: () => 'generated-id',
      telemetry: () => telemetry!,
    });
    const room = new RoomObject(testState.state, {});

    const response = await room.fetch(
      new Request('https://room.test/room', {
        headers: {
          traceparent: `00-${UPGRADE_TRACE_ID}-2222222222222222-01`,
        },
      })
    );
    expect(response.status).toBe(400);
    await room.webSocketMessage?.(socket, '{bad json');
    await room.webSocketError?.(socket, new Error('socket failed'));
    await testState.drain();

    const spans = exporter.getFinishedSpans();
    const upgrade = spans.find(
      (span) => span.name === 'room.websocket.upgrade'
    );
    const message = spans.find(
      (span) => span.name === 'room.websocket.message'
    );
    const socketError = spans.find(
      (span) => span.name === 'room.websocket.error'
    );
    expect(upgrade?.spanContext().traceId).toBe(UPGRADE_TRACE_ID);
    expect(upgrade?.attributes[ATTR.HTTP_RESPONSE_STATUS_CODE]).toBe(400);
    expect(message?.spanContext().traceId).not.toBe(CONNECTION_TRACE_ID);
    expect(message?.links[0]?.context.traceId).toBe(CONNECTION_TRACE_ID);
    expect(message?.attributes[ATTR.USER_ID]).toBe('user-1');
    expect(message?.attributes[ATTR.APP_ROOM_TOPIC]).toBe('topic-1');
    expect(message?.attributes[ATTR.APP_ROOM_OUTCOME]).toBe('invalid_frame');
    expect(socketError?.spanContext().traceId).not.toBe(CONNECTION_TRACE_ID);
    expect(socketError?.links[0]?.context.traceId).toBe(CONNECTION_TRACE_ID);
    expect(socketError?.status.message).toBe('socket failed');
    expect(closed).toContainEqual({ code: 1003, reason: 'invalid JSON frame' });
    expect(testState.scheduled).toHaveLength(3);
  });
});

function createHibernatedSocket(
  closed: Array<{ readonly code: number; readonly reason: string }>
): WebSocket {
  const attachment = {
    connId: 'connection-1',
    identityRaw: 'user-1',
    clientId: 'client-1',
    moduleName: gameRoomModule.name,
    topic: 'topic-1',
    traceparent: `00-${CONNECTION_TRACE_ID}-1111111111111111-01`,
  };
  return {
    close(code: number, reason: string) {
      closed.push({ code, reason });
    },
    deserializeAttachment: () => attachment,
    send: () => undefined,
    serializeAttachment: () => undefined,
  } as unknown as WebSocket;
}
