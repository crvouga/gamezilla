import { describe, expect, test } from 'bun:test';
import {
  createStaticFileHandler,
  DEFAULT_MIME_TYPES,
} from '@pkgs/static-file-shared-ts/static-file-server';

function mockRequest(path: string, base = 'http://localhost/'): Request {
  return new Request(new URL(path, base));
}

describe('createStaticFileHandler', () => {
  test('serves file when getFile returns Blob', async () => {
    const handler = createStaticFileHandler({
      getFile: (path) =>
        path === '/index.html' ? new Blob(['<html/>']) : null,
    });
    const res = await handler(mockRequest('/index.html'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/html');
    expect(await res.text()).toBe('<html/>');
  });

  test('returns 404 when file not found and no index', async () => {
    const handler = createStaticFileHandler({
      getFile: () => null,
    });
    const res = await handler(mockRequest('/missing'));
    expect(res.status).toBe(404);
  });

  test('SPA fallback: serves index when path not found', async () => {
    const handler = createStaticFileHandler({
      getFile: (path) => (path === '/index.html' ? new Blob(['spa']) : null),
    });
    const res = await handler(mockRequest('/some/route'));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('spa');
  });

  test('returns 403 for path traversal (encoded ..)', async () => {
    const handler = createStaticFileHandler({
      getFile: () => new Blob(['nope']),
    });
    // URL with ..%2f decodes to path containing ..
    const res = await handler(mockRequest('/..%2f..%2fetc/passwd'));
    expect(res.status).toBe(403);
  });

  test('returns 403 for path starting with //', async () => {
    const handler = createStaticFileHandler({
      getFile: () => new Blob(['nope']),
    });
    const res = await handler(new Request('http://localhost//foo'));
    expect(res.status).toBe(403);
  });

  test('correct Content-Type for extensions', async () => {
    const handler = createStaticFileHandler({
      getFile: (_path) => new Blob(['x']),
    });
    const cases = [
      ['/a.js', 'application/javascript'],
      ['/a.css', 'text/css'],
      ['/a.json', 'application/json'],
      ['/a.png', 'image/png'],
    ];
    for (const [path, expected] of cases) {
      if (
        path === null ||
        path === undefined ||
        expected === null ||
        expected === undefined
      ) {
        throw new Error('Invalid test case: path and expected must be defined');
      }
      const res = await handler(mockRequest(path));
      expect(res.headers.get('Content-Type')).toBe(expected);
    }
  });

  test('custom indexPath', async () => {
    const handler = createStaticFileHandler({
      getFile: (path) => (path === '/app.html' ? new Blob(['app']) : null),
      indexPath: '/app.html',
    });
    const res = await handler(mockRequest('/unknown'));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('app');
  });

  test('custom mimeTypes override defaults', async () => {
    const handler = createStaticFileHandler({
      getFile: (_path) => new Blob(['x']),
      mimeTypes: { '.foo': 'application/x-foo' },
    });
    const res = await handler(mockRequest('/a.foo'));
    expect(res.headers.get('Content-Type')).toBe('application/x-foo');
  });

  test('root path maps to index.html', async () => {
    const handler = createStaticFileHandler({
      getFile: (path) => (path === '/index.html' ? new Blob(['root']) : null),
    });
    const res = await handler(mockRequest('/'));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('root');
  });
});

describe('DEFAULT_MIME_TYPES', () => {
  test('includes common extensions', () => {
    expect(DEFAULT_MIME_TYPES['.html']).toBe('text/html');
    expect(DEFAULT_MIME_TYPES['.js']).toBe('application/javascript');
    expect(DEFAULT_MIME_TYPES['.css']).toBe('text/css');
  });
});
