import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';

import { createLabSession } from './host/session';
import type { LabCommand, LabSnapshot } from './host/types';

const PORT = Number(process.env['SIM_LAB_PORT'] ?? 7788);
const WEB_DIR = new URL('./web/', import.meta.url).pathname;

const session = createLabSession();
const listeners = new Set<(snap: LabSnapshot) => void>();

function broadcast(snap: LabSnapshot): void {
  for (const listener of listeners) listener(snap);
}

async function dispatch(cmd: LabCommand): Promise<LabSnapshot> {
  const snap = await session.dispatch(cmd);
  broadcast(snap);
  return snap;
}

const app = new Hono();
app.use('*', cors());

app.get('/api/snapshot', async (c) => {
  return c.json(await session.getSnapshot());
});

app.post('/api/command', async (c) => {
  const body = (await c.req.json()) as LabCommand;
  const snap = await dispatch(body);
  return c.json(snap);
});

app.get('/api/events', (c) => {
  return streamSSE(c, async (stream) => {
    const send = async (snap: LabSnapshot) => {
      await stream.writeSSE({
        event: 'snapshot',
        data: JSON.stringify(snap),
      });
    };
    listeners.add(send);
    await send(await session.getSnapshot());
    try {
      while (!stream.closed) {
        await stream.sleep(15_000);
        await stream.writeSSE({ event: 'ping', data: '{}' });
      }
    } finally {
      listeners.delete(send);
    }
  });
});

const buildResult = await Bun.build({
  entrypoints: [`${WEB_DIR}main.tsx`],
  target: 'browser',
  format: 'esm',
  minify: false,
  sourcemap: 'none',
});

if (!buildResult.success) {
  console.error(buildResult.logs);
  throw new Error('sim-lab web build failed');
}

const appJs = buildResult.outputs[0];
if (appJs === undefined)
  throw new Error('sim-lab web build produced no output');
const appJsBytes = await appJs.arrayBuffer();

const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sync Engine Sim Lab</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/app.js"></script>
  </body>
</html>`;

app.get('/', (c) => c.html(indexHtml));
app.get('/app.js', () => {
  return new Response(appJsBytes, {
    headers: { 'content-type': 'application/javascript; charset=utf-8' },
  });
});
app.get('/styles.css', async () => {
  const file = Bun.file(`${WEB_DIR}styles.css`);
  return new Response(file, {
    headers: { 'content-type': 'text/css; charset=utf-8' },
  });
});

await dispatch({ type: 'openWorld', seed: 42 });

const server = Bun.serve({
  port: PORT,
  fetch: app.fetch,
});

process.stdout.write(`Sync Engine Sim Lab → http://localhost:${server.port}\n`);

process.on('SIGINT', async () => {
  await session.dispose();
  process.exit(0);
});
