# `@pkgs/ndjson`

Indexed batch streaming over **Server-Sent Events** (`text/event-stream`). One request fans out into N work units; the server emits results in completion order so a slow item never blocks faster siblings, and the client puts each slice back in its original position by `index`.

The package is intentionally narrow — codec, decoder, parallel streamer, indexed collector — and stays runtime-agnostic. Domain mapping (auth rejection, structured server crashes, rate limiting, etc.) lives in the calling transport.

## Wire protocol

One JSON object per SSE `data:` event. Three frame kinds:

| `frame`  | Required fields                                      | Optional fields                   | Meaning                                                                                                  |
| -------- | ---------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `result` | `index: number`, `result: any`                       | —                                 | Output for the work unit at `index`.                                                                     |
| `error`  | `index: number`, `status: number`, `message: string` | `kind: string`, `context: object` | Failure for the work unit at `index`. `index = -1` is a stream-level tail error (uncaught producer bug). |
| `end`    | —                                                    | —                                 | Sentinel: no more frames will follow.                                                                    |

```text
data: {"frame":"result","index":0,"result":{"x":1}}

data: {"frame":"result","index":2,"result":{"x":3}}

data: {"frame":"error","index":1,"status":500,"message":"...","kind":"crash","context":{"reason":"..."}}

data: {"frame":"end"}

```

**Rules consumers can rely on:**

- The stream MUST terminate with exactly one `end` frame. A truncated stream (no `end`) is a transport error.
- Each declared `index` (`0..N-1`) MUST receive exactly one `result` or `error` frame. A missing slot is a producer bug.
- Per-item `error` frames do not abort the stream — sibling work units still emit `result` (or `error`) frames.
- The first `error` is the canonical failure surfaced to the client; subsequent errors are still observable via the eager `onErrorFrame` hook.

The negotiated content type is `text/event-stream` (exported as `EVENT_STREAM_CONTENT_TYPE`). Each indexed frame is one SSE `data:` event so browser DevTools can parse the stream. Servers that fall back to flat JSON when the client does not advertise streaming support are encouraged but out of scope for this package.

## Layout

```text
pkgs/ndjson/src/
├── shared/  # frame types, codec, streaming line decoder
├── client/  # IndexedNdjsonCollector, collectIndexedNdjsonStream, accept-header
├── server/  # streamParallelIndexed, encodeNdjsonReadableStream
└── README.md
```

| Import                | Purpose                                                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `@pkgs/ndjson/shared` | Frame types + `encodeNdjsonFrame` + `NdjsonStreamDecoder` + `EVENT_STREAM_CONTENT_TYPE`                                             |
| `@pkgs/ndjson/client` | `IndexedNdjsonCollector`, `collectIndexedNdjsonStream`, `acceptsEventStream`, `eventStreamAcceptHeader`, `IndexedNdjsonStreamError` |
| `@pkgs/ndjson/server` | `streamParallelIndexed`, `encodeNdjsonReadableStream`                                                                               |

## Server example

```ts
import { acceptsEventStream } from '@pkgs/ndjson/client';
import { EVENT_STREAM_CONTENT_TYPE } from '@pkgs/ndjson/shared';
import {
  encodeNdjsonReadableStream,
  streamParallelIndexed,
} from '@pkgs/ndjson/server';

async function readHandler(req: Request, host: ReadHost): Promise<Response> {
  const queries = await req.json();
  if (!acceptsEventStream(req.headers.get('accept'))) {
    // Caller wants flat JSON — answer with a single Promise.all instead.
    const results = await Promise.all(queries.map((q) => host.read(q)));
    return Response.json({ results });
  }
  const frames = streamParallelIndexed(
    queries.length,
    (i) => host.read(queries[i]),
    (index, error) => ({
      frame: 'error',
      index,
      status: error instanceof ForbiddenError ? 403 : 500,
      message: error instanceof Error ? error.message : String(error),
    })
  );
  const body = encodeNdjsonReadableStream(frames);
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': EVENT_STREAM_CONTENT_TYPE },
  });
}
```

`mapError` lets the producer attach domain-specific `kind` / `context` to per-item failures so the client can branch (e.g. promote certain errors to a structured exception). `encodeNdjsonReadableStream` accepts an optional `mapTailError` for the safety net at index `-1` — defaulting to a generic 500 derived from `error.message`.

## Client example

```ts
import {
  collectIndexedNdjsonStream,
  eventStreamAcceptHeader,
  IndexedNdjsonStreamError,
} from '@pkgs/ndjson/client';

async function read(queries: Query[]): Promise<Result[]> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: eventStreamAcceptHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ queries }),
  });
  if (res.headers.get('content-type')?.includes('text/event-stream')) {
    try {
      return await collectIndexedNdjsonStream<Result>(res.body, queries.length);
    } catch (e) {
      if (e instanceof IndexedNdjsonStreamError && e.kind === 'forbidden') {
        throw new MyAuthError(e.message);
      }
      throw e;
    }
  }
  // Flat JSON fallback for older servers.
  const flat: { results: Result[] } = await res.json();
  return flat.results;
}
```

The `onErrorFrame` hook fires the moment an `error` frame is decoded — useful when a transport needs to _eagerly_ dispatch the failure (e.g. surface a server crash through a registered crash-handler chain) before the rest of the stream completes.

## Layering

This package is a leaf utility:

- It does not depend on any other workspace package.
- It does not import Hono, Cloudflare Workers types, or any HTTP framework.
- All `client` / `server` boundary affordances are stateless functions plus one small class — no singletons.

Higher tiers (libs, apps) compose these primitives into their own indexed batch endpoints.
