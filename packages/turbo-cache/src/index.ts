import { Hono } from 'hono';

interface Env {
  CACHE_BUCKET: R2Bucket;
  TURBO_TOKEN: string;
}

const HEX_HASH = /^[a-f0-9]{1,128}$/;
const SAFE_KEY_SEGMENT = /^[\w.@-]{1,256}$/;

function sanitizeHeaderValue(raw: string | null): string | undefined {
  if (raw === null) return undefined;
  const clean = raw.replace(/[\r\n\x00-\x1f]/g, '').slice(0, 256);
  return clean.length > 0 ? clean : undefined;
}

const app = new Hono<{ Bindings: Env }>()
  .use('*', async (c, next) => {
    if (c.req.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }
    const path = new URL(c.req.url).pathname;
    if (c.req.method === 'GET' && path === '/health') {
      return c.json({ status: 'ok' });
    }
    if (typeof c.env.TURBO_TOKEN !== 'string' || c.env.TURBO_TOKEN.length === 0) {
      return c.json({ error: 'Server misconfigured' }, 500);
    }
    if (!authorize(c.req.raw, c.env.TURBO_TOKEN)) {
      return c.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return next();
  })
  .all('/v8/artifacts/:hash', async (c) => {
    const hash = c.req.param('hash');
    if (!HEX_HASH.test(hash)) {
      return c.json({ error: 'Invalid artifact hash' }, 400);
    }
    const teamId = new URL(c.req.url).searchParams.get('teamId') ?? 'default';
    if (!SAFE_KEY_SEGMENT.test(teamId)) {
      return c.json({ error: 'Invalid teamId' }, 400);
    }
    const key = `${teamId}/${hash}`;
    if (c.req.method === 'PUT') {
      return handlePut(c.env, key, c.req.raw);
    }
    if (c.req.method === 'GET') {
      return handleGet(c.env, key);
    }
    return c.json({ error: 'Method not allowed' }, 405);
  })
  .post('/v8/artifacts/events', (c) => c.json({}))
  .get('/v8/artifacts/status', (c) => c.json({ status: 'enabled' }))
  .get('/v2/user', (c) =>
    c.json({
      user: {
        id: 'turbo-cache',
        username: 'turbo-cache',
        email: 'cache@localhost',
      },
    })
  )
  .get('/v2/teams', (c) => {
    const slug = new URL(c.req.url).searchParams.get('slug') ?? 'default';
    return c.json({ teams: [{ id: slug, slug, name: slug }] });
  })
  .get('/v2/teams/:teamId', (c) => {
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
  const tag = sanitizeHeaderValue(request.headers.get('x-artifact-tag'));

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
