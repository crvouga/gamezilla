import type { Link, Span } from '@opentelemetry/api';
import {
  context,
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
} from '@opentelemetry/api';
import { extractRequestContext } from '@pkgs/observability-root-server-ts/worker-worker';
import { ATTR } from '@pkgs/observability-root-shared-ts/attributes';
import { linkFromTraceparent } from '@pkgs/observability-root-shared-ts/correlation';
import {
  recordException,
  withSpan,
} from '@pkgs/observability-root-shared-ts/span';

import type { WsMeta } from './hibernation-restore';

type UpgradeDetails = {
  readonly moduleName: string;
  readonly topic: string;
};

/** Rare execution failures use the room's existing root trace/export path. */
export function observeRoomLiveError(
  error: unknown,
  moduleName: string
): Promise<void> {
  return withSpan(
    'room.live.failure',
    async (span) => {
      const exception =
        error instanceof Error ? error : new Error(String(error));
      recordException(span, exception);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: exception.message,
      });
    },
    { [ATTR.APP_ROOM_MODULE]: moduleName }
  );
}

export async function observeRoomUpgrade(
  request: Request,
  details: UpgradeDetails,
  run: (span: Span) => Promise<Response>
): Promise<Response> {
  return context.with(extractRequestContext(request.headers), () =>
    withSpan(
      'room.websocket.upgrade',
      async (span) => {
        const response = await run(span);
        span.setAttribute(ATTR.HTTP_RESPONSE_STATUS_CODE, response.status);
        span.setAttribute(
          ATTR.APP_ROOM_OUTCOME,
          response.status === 101 ? 'accepted' : 'rejected'
        );
        return response;
      },
      {
        [ATTR.HTTP_REQUEST_METHOD]: request.method,
        [ATTR.HTTP_ROUTE]: '/room',
        [ATTR.APP_ROOM_MODULE]: details.moduleName,
        [ATTR.APP_ROOM_TOPIC]: details.topic,
      },
      { kind: SpanKind.SERVER }
    )
  );
}

export async function observeRoomMessage<Identity>(
  meta: WsMeta<Identity>,
  messageBytes: number,
  run: (span: Span) => Promise<void>
): Promise<void> {
  await withLinkedSocketContext(meta.traceparent, (links) =>
    withSpan(
      'room.websocket.message',
      run,
      socketAttributes(meta, {
        [ATTR.APP_ROOM_MESSAGE_BYTES]: messageBytes,
      }),
      { kind: SpanKind.CONSUMER, links }
    )
  );
}

export async function observeRoomError<Identity>(
  meta: WsMeta<Identity>,
  error: unknown,
  run: () => void
): Promise<void> {
  await withLinkedSocketContext(meta.traceparent, (links) =>
    withSpan(
      'room.websocket.error',
      (span) => {
        const exception =
          error instanceof Error ? error : new Error(String(error));
        recordException(span, exception);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: exception.message,
        });
        span.setAttribute(ATTR.APP_ROOM_OUTCOME, 'error');
        run();
      },
      socketAttributes(meta),
      { kind: SpanKind.CONSUMER, links }
    )
  );
}

function socketAttributes<Identity>(
  meta: WsMeta<Identity>,
  extra: { readonly [ATTR.APP_ROOM_MESSAGE_BYTES]?: number } = {}
) {
  return {
    [ATTR.USER_ID]: meta.identityRaw,
    [ATTR.APP_ROOM_CONNECTION_ID]: meta.id,
    [ATTR.APP_ROOM_MODULE]: meta.moduleName,
    [ATTR.APP_ROOM_TOPIC]: meta.topic,
    ...extra,
  };
}

function withLinkedSocketContext<T>(
  traceparent: string | null,
  run: (links: Link[]) => T
): T {
  const link =
    traceparent === null ? undefined : linkFromTraceparent(traceparent);
  return context.with(ROOT_CONTEXT, () =>
    run(link === undefined ? [] : [link])
  );
}
