import { expect, test } from 'bun:test';
import { distHeadersFile } from './dist-headers';

// regression: offline-reload-frozen-page-holds-local-database
test('documents stay out of the back/forward cache; built assets keep caching', () => {
  const headers = distHeadersFile([
    'index.html',
    '_headers',
    'favicon.ico',
    'sw.js',
    'assets/index-DBZfr4vT.js',
    'assets/index-CvVCyPSu.css',
    'sql-workers/sqlite-worker.js',
    'harness/index.html',
    'harness/harness-a1.js',
  ]);
  expect(headers).toBe(
    [
      '/*',
      '\tCross-Origin-Opener-Policy: same-origin',
      '\tCross-Origin-Embedder-Policy: require-corp',
      '\tCache-Control: no-store',
      '',
      '/sso-callback',
      '\tCross-Origin-Opener-Policy: same-origin-allow-popups',
      '',
      '/assets/*',
      '\t! Cache-Control',
      '',
      '/favicon.ico',
      '\t! Cache-Control',
      '',
      '/sql-workers/*',
      '\t! Cache-Control',
      '',
      '/sw.js',
      '\t! Cache-Control',
      '',
    ].join('\n')
  );
});
