/** Detach immediately, then close once a pending handshake has completed. */
export function closeRoomSocket(socket: WebSocket, reason: string): void {
  socket.onmessage = null;
  socket.onerror = null;
  socket.onclose = null;
  socket.onopen = null;
  if (socket.readyState === WebSocket.CONNECTING) {
    // Closing CONNECTING aborts the handshake and emits a browser error.
    // The retired socket must never notify the room or start a heartbeat.
    socket.onopen = () => {
      socket.onopen = null;
      socket.close(1000, reason);
    };
  } else if (socket.readyState === WebSocket.OPEN) {
    socket.close(1000, reason);
  }
}
