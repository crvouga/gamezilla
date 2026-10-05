// @io-wall-ok — browser conformance runner: serves a compiled example, never the development app.
import { resolve } from 'node:path';
import { build, preview } from 'vite';

export async function openBrowserExample() {
  const configFile = resolve(import.meta.dirname, '../../vite.config.mts');
  await build({ configFile, logLevel: 'error' });
  const server = await preview({
    configFile,
    preview: { host: '127.0.0.1', port: 0 },
    logLevel: 'error',
  });
  const address = server.httpServer.address();
  if (address === null || typeof address === 'string')
    throw new Error('Missing browser example address');
  const view = new Bun.WebView({
    width: 800,
    height: 800,
    backend:
      process.platform === 'darwin' ? 'webkit' : { type: 'chrome', url: false },
    dataStore: 'ephemeral',
  });
  try {
    await view.navigate(`http://127.0.0.1:${address.port}`);
    await view.evaluate(
      'window.boardExampleReady.then(() => window.boardExample.paint())'
    );
  } catch (error) {
    view.close();
    server.httpServer.close();
    throw error;
  }
  return {
    view,
    close() {
      view.close();
      server.httpServer.close();
    },
  };
}
