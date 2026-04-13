import { Hono } from 'hono';

interface Env {
  CACHE_BUCKET: R2Bucket;
  TURBO_TOKEN: string;
}

const HEX_HASH = /^[a-f0-9]+$/;

const app = new Hono<{ Bindings: Env }>();

app.use('*', async (c, next) => {
  if (c.req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }
  const path = new URL(c.req.url).pathname;
  if (c.req.method === 'GET' && path === '/health') {
    return c.json({ status: 'ok' });
  }
  if (!authorize(c.req.raw, c.env.TURBO_TOKEN)) {
    return c.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return next();
});

app.all('/v8/artifacts/:hash', async (c) => {
  const hash = c.req.param('hash');
  if (!HEX_HASH.test(hash)) {
    return c.json({ error: 'Not found' }, 404);
  }
  const teamId = new URL(c.req.url).searchParams.get('teamId') ?? 'default';
  const key = `${teamId}/${hash}`;
  if (c.req.method === 'PUT') {
    return handlePut(c.env, key, c.req.raw);
  }
  if (c.req.method === 'GET') {
    return handleGet(c.env, key);
  }
  return c.json({ error: 'Method not allowed' }, 405);
});

app.post('/v8/artifacts/events', (c) => c.json({}));

app.get('/v8/artifacts/status', (c) => c.json({ status: 'enabled' }));

app.get('/v2/user', (c) =>
  c.json({
    user: {
      id: 'turbo-cache',
      username: 'turbo-cache',
      email: 'cache@localhost',
    },
  })
);

app.get('/v2/teams', (c) => {
  const slug = new URL(c.req.url).searchParams.get('slug') ?? 'default';
  return c.json({ teams: [{ id: slug, slug, name: slug }] });
});

app.get('/v2/teams/:teamId', (c) => {
  const teamId = c.req.param('teamId');
  return c.json({ id: teamId, slug: teamId, name: teamId });
});

export default {
  fetch(request: Request, env: Env, _ctx: ExecutionContext): Response | Promise<Response> {
    return app.fetch(request, env);
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
  request: Request
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
