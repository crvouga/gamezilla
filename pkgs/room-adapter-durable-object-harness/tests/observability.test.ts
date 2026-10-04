import { afterEach, describe, expect, test } from 'bun:test';
import { context, trace } from '@opentelemetry/api';
import { InMemorySpanExporter } from '@opentelemetry/sdk-trace-base';
import type { WorkerTelemetry } from '@pkgs/observability-server/worker-worker';
import { createWorkerTelemetry } from '@pkgs/observability-server/worker-worker';
import { ATTR } from '@pkgs/observability-shared/attributes';
import { createDurableObjectAdapter } from '@pkgs/room-adapter-durable-object-server/adapter';
import type { DurableObjectInstanceState } from '@pkgs/room-adapter-durable-object-shared/types';
import { gameRoomModule } from '@pkgs/room-harness/game-room';
import { MemoryKv } from './memory-kv';

const CONNECTION_TRACE_ID = '11111111111111111111111111111111';
const UPGRADE_TRACE_ID = '22222222222222222222222222222222';

function createTestState(sockets: WebSocket[]): {
  readonly state: DurableObjectInstanceState;
  readonly scheduled: Promise<unknown>[];
  readonly drain: () => Promise<void>;
} {
  const scheduled: Promise<unknown>[] = [];
  return {
    state: {
      storage: new MemoryKv(),
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
