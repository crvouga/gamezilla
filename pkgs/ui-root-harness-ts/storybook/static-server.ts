// @io-wall-ok — test-owned static Storybook server; Playwright owns cleanup
import { resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '../.cache/storybook');
Bun.serve({
  hostname: '127.0.0.1',
  port: 6007,
  async fetch(request) {
    const path = resolve(
      root,
      `.${decodeURIComponent(new URL(request.url).pathname)}`
    );
    if (path !== root && !path.startsWith(`${root}${sep}`))
      return new Response('Forbidden', { status: 403 });
    const file = Bun.file(path === root ? resolve(root, 'index.html') : path);
    if (!(await file.exists()))
      return new Response('Not found', { status: 404 });
    return new Response(file);
  },
});
