/**
 * Serves the generated `sim-viz/` folder over HTTP (default port 8765).
 * Use if `file://` blocks sql.js WASM; open http://127.0.0.1:8765
 */
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..', '..', '..', '..', 'sim-viz');

const port = Number(process.env['SIM_VIZ_PORT'] ?? '8765');

Bun.serve({
  port,
  async fetch(req) {
    let pathname = new URL(req.url).pathname;
    if (pathname === '/') pathname = '/index.html';
    const file = Bun.file(join(ROOT, pathname.replace(/^\//, '')));
    if (await file.exists()) return new Response(file);
    return new Response('Not found', { status: 404 });
  },
});

console.log(`sim-viz → http://127.0.0.1:${port}`);
