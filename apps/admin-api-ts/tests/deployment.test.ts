import { expect, test } from 'bun:test';
import { checkAdminDeployment } from '@apps/admin-api-ts/check-deployment';

const origin = 'https://admin.example.test';
const shell =
  '<title>Example Administration</title><script type="module" src="/assets/index-abc.js"></script>';

function probe(
  overrides: Record<string, { status: number; body: string }> = {}
) {
  const routes: Record<string, { status: number; body: string }> = {
    '/': { status: 200, body: shell },
    '/assets/index-abc.js': {
      status: 200,
      body: '/*! Origin: fixture */ export {}',
    },
    '/api/admin/access': {
      status: 401,
      body: '{"error":"Sign in to open administration."}',
    },
    ...overrides,
  };
  return (url: string) => {
    const target = new URL(url);
    if (target.origin !== origin)
      throw new Error(`Unexpected probe target ${url}`);
    return Promise.resolve(
      routes[target.pathname] ?? { status: 404, body: '' }
    );
  };
}

test('the public admin hostname serves its entry module and refuses anonymous access', async () => {
  await checkAdminDeployment(origin, probe());
});

test.each([
  ['/', 200, '<title>Example</title>'],
  ['/assets/index-abc.js', 200, shell],
  ['/api/admin/access', 200, '{}'],
  ['/api/admin/access', 401, '{"error":"Unauthorized"}'],
  ['/api/admin/access', 401, shell],
  ['/api/admin/access', 404, 'Not found'],
])(
  'admin deployment rejects a misrouted %s response with HTTP %i',
  async (path, status, body) => {
    await expect(
      checkAdminDeployment(origin, probe({ [path]: { status, body } }))
    ).rejects.toThrow(origin);
  }
);
