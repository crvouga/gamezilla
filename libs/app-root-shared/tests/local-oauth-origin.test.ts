import { expect, test } from 'bun:test';
import { getServerBaseUrl as apiServer } from '@libs/app-root-shared/api-servers';
import { getServerBaseUrl as apiUrl } from '@libs/app-root-shared/api-url';

test('OAuth keeps the configured loopback host and its cookie boundary', () => {
  // regression: oauth-launch-localhost-header-overflow
  const previous = process.env['VITE_API_URL'];
  process.env['VITE_API_URL'] = 'http://127.0.0.1:63877';
  try {
    expect(apiUrl()).toBe('http://127.0.0.1:63877');
    expect(apiServer()).toBe('http://127.0.0.1:63877');
  } finally {
    if (previous === undefined) delete process.env['VITE_API_URL'];
    else process.env['VITE_API_URL'] = previous;
  }
});
