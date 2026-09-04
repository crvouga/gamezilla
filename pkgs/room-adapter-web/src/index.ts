/**
 * `@pkgs/room-adapter-web` — browser room adapters.
 *
 * The web vertical of `@pkgs/room`: a synchronous `localStorage`-backed
 * `ClientRoomStorage` and a `WebSocket` `ClientTransport` with heartbeat +
 * exponential-backoff reconnect.
 */

export { WebClientStorage } from './client-storage';
export type { WebSocketRoomTransportOptions } from './websocket-transport';
export { WebSocketRoomTransport } from './websocket-transport';
