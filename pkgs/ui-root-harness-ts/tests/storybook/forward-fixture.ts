// @io-wall-ok — test-owned local TCP forwarding, including WebSocket upgrades.
import { createServer, request } from 'node:http';
import { connect } from 'node:net';

const server = createServer((incoming, outgoing) => {
  const upstream = request(
    {
      hostname: '127.0.0.1',
      port: 6010,
      path: incoming.url,
      method: incoming.method,
      headers: incoming.headers,
    },
    (response) => {
      outgoing.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(outgoing);
    }
  );
  upstream.on('error', () => {
    outgoing.writeHead(502);
    outgoing.end();
  });
  incoming.pipe(upstream);
});
server.on('upgrade', (incoming, socket, head) => {
  const upstream = connect(6010, '127.0.0.1', () => {
    const headers = incoming.rawHeaders.reduce<string[]>(
      (lines, value, index, all) =>
        index % 2 === 0 ? [...lines, `${value}: ${all[index + 1]}`] : lines,
      []
    );
    upstream.write(
      `${incoming.method} ${incoming.url} HTTP/${incoming.httpVersion}\r\n${headers.join('\r\n')}\r\n\r\n`
    );
    upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
  socket.on('close', () => upstream.destroy());
});
server.listen(6011, '127.0.0.1');
