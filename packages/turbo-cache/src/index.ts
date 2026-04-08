interface Env {
  CACHE_BUCKET: R2Bucket;
  TURBO_TOKEN: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (request.method === 'GET' && new URL(request.url).pathname === '/health')
      return Response.json({ status: 'ok' });

    if (!authorize(request, env.TURBO_TOKEN)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const match = url.pathname.match(/^\/v8\/artifacts\/([a-f0-9]+)$/);

    if (match) {
      const hash = match[1];
      const teamId = url.searchParams.get('teamId') ?? 'default';
      const key = `${teamId}/${hash}`;

      if (request.method === 'PUT') return handlePut(env, key, request);
      if (request.method === 'GET') return handleGet(env, key);
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    if (
      request.method === 'POST' &&
      url.pathname === '/v8/artifacts/events'
    ) {
      return Response.json({});
    }

    if (
      request.method === 'GET' &&
      url.pathname === '/v8/artifacts/status'
    ) {
      return Response.json({ status: 'enabled' });
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;

function authorize(request: Request, token: string): boolean {
  const header = request.headers.get('Authorization');
  if (!header) return false;
  return header === `Bearer ${token}`;
}

async function handlePut(
  env: Env,
  key: string,
  request: Request,
): Promise<Response> {
  const body = await request.arrayBuffer();
  const tag = request.headers.get('x-artifact-tag') ?? undefined;

  const customMetadata: Record<string, string> = {};
  if (tag) customMetadata['artifactTag'] = tag;

  await env.CACHE_BUCKET.put(key, body, {
    httpMetadata: {
      contentType: 'application/octet-stream',
    },
    customMetadata,
  });

  return Response.json({ urls: [key] });
}

async function handleGet(env: Env, key: string): Promise<Response> {
  const object = await env.CACHE_BUCKET.get(key);
  if (!object) {
    return Response.json({ error: 'Artifact not found' }, { status: 404 });
  }

  const headers = new Headers();
  headers.set('Content-Type', 'application/octet-stream');
  const tag = object.customMetadata?.['artifactTag'];
  if (tag) headers.set('x-artifact-tag', tag);

  return new Response(object.body, { headers });
}
