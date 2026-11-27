import { roomServiceClient } from './create-room-service';

/** API nodes and spec fixtures reach the same topic owner as a stack browser. */
export function localRoomServiceRequest(
  request: Request,
  apiOrigin: string,
  token: string
): Request {
  const target = new URL('/__room-service', apiOrigin);
  target.search = new URL(request.url).search;
  const forwarded = new Request(target, request);
  forwarded.headers.set('x-room-service-token', token);
  return forwarded;
}

export function localRoomService(
  apiOrigin: string,
  token: string,
  send: (request: Request) => Promise<Response>
) {
  return roomServiceClient((_topic, request) =>
    send(localRoomServiceRequest(request, apiOrigin, token))
  );
}
