// @io-wall-ok — browser room transport adapter for the wall composition root.
/**
 * The spaces answer to the shell's `CreateRoomTransport` port: a real
 * WebSocket to the room Worker, addressed by space topic.
 *
 * The shell declares that a client may need a room transport; only spaces
 * knows a room is a space and what its URL looks like, so the factory lives
 * here and the composition root hands it to `wallClientEnv`.
 */

import type { CreateRoomTransport } from '@libs/app-root-client/client-env';
import { apiUrlToRoomWebSocketUrl } from '@libs/spaces-shared/space-room-url';
import { WebSocketRoomTransport } from '@pkgs/room-adapter-web-shared/websocket-transport';

export const wallSpaceRoomTransport: CreateRoomTransport = (args) => {
  const topic = `space:${args.spaceId}`;
  return new WebSocketRoomTransport({
    timers: args.timers,
    random: args.random,
    url: async () => {
      const token = await Promise.resolve(args.getSessionToken());
      return apiUrlToRoomWebSocketUrl({
        apiUrl: args.apiUrl,
        topic,
        sessionToken: token,
        installId: args.installId,
        clientId: args.clientId,
      });
    },
  });
};
