import { describe, expect, test } from 'bun:test';
import type { RoomGrantsCtx } from '@libs/feature/public/server';
import {
  type ApiRequestAsyncStore,
  apiRequestAsyncLocalStorage,
} from '@libs/server-app/request-scope';
import {
  createRoomApp,
  ROOM_ACTOR_GRANTS_HEADER,
  ROOM_ACTOR_ID_HEADER,
} from '@libs/server-app/room/route';

const INSTALL_ID = '0b6f6a52-5f0e-4a39-9d1c-2f7f3f1f7a10';
const TOPIC = 'space:the-space';

/** The room host behind the gateway: records what the gateway forwarded. */
function recordingRoomHost() {
  const forwarded: Request[] = [];
  return {
    forwarded,
    ROOM: {
      idFromName: (name: string) => ({ name }),
      get: () => ({
        fetch: (request: Request) => {
          forwarded.push(request);
          return Promise.resolve(new Response(null, { status: 200 }));
        },
      }),
    },
  };
}

const store = {
  sqlClient: {},
  clock: { now: () => 1_000 },
  createId: () => 'minted-id',
} as unknown as ApiRequestAsyncStore;

async function upgrade(
  grantsFor: (ctx: RoomGrantsCtx) => Promise<readonly string[]>,
  headers: Record<string, string>
): Promise<Request> {
  const host = recordingRoomHost();
  const app = createRoomApp(grantsFor);
  await apiRequestAsyncLocalStorage.run(store, () =>
    app.request(
      `/room?topic=${encodeURIComponent(TOPIC)}&anonId=${INSTALL_ID}`,
      { headers: { upgrade: 'websocket', ...headers } },
      { ROOM: host.ROOM }
    )
  );
  const [request] = host.forwarded;
  if (request === undefined) throw new Error('the gateway forwarded nothing');
  return request;
}

describe('room gateway: the grants a connection is admitted with', () => {
  // regression: space-game-choice-unguarded
  test('a client cannot forge grants: its own value is replaced', async () => {
    const request = await upgrade(() => Promise.resolve([]), {
      [ROOM_ACTOR_GRANTS_HEADER]: 'spaces:select-game',
    });
    expect(request.headers.get(ROOM_ACTOR_GRANTS_HEADER)).toBe('');
  });

  test('forwards what the features decided for the resolved actor', async () => {
    const seen: RoomGrantsCtx[] = [];
    const request = await upgrade((ctx) => {
      seen.push(ctx);
      return Promise.resolve(['spaces:select-game']);
    }, {});
    expect(request.headers.get(ROOM_ACTOR_GRANTS_HEADER)).toBe(
      'spaces:select-game'
    );
    expect(request.headers.get(ROOM_ACTOR_ID_HEADER)).toBe(INSTALL_ID);
    expect(seen.map((ctx) => [ctx.topic, ctx.actor, ctx.nowMs])).toEqual([
      [
        TOPIC,
        { memberId: INSTALL_ID, deviceId: INSTALL_ID, accountId: null },
        1_000,
      ],
    ]);
  });

  test('a failed decision admits the connection with no grants', async () => {
    const request = await upgrade(() => Promise.reject(new Error('db down')), {
      [ROOM_ACTOR_GRANTS_HEADER]: 'spaces:select-game',
    });
    expect(request.headers.get(ROOM_ACTOR_GRANTS_HEADER)).toBe('');
  });
});
