// @io-wall-ok — reports a cache fingerprint without opening a browser session.
import {
  chromeVersion,
  findChrome,
} from '@pkgs/ui-testing-bun-webview-server/test-browser';

if (import.meta.main) {
  const path = findChrome();
  console.log(
    JSON.stringify({ chrome: path === null ? null : chromeVersion(path) })
  );
}
