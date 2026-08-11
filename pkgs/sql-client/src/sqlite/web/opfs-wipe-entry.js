// @io-wall-ok — index.html entry: replace document with OPFS wipe shell before Expo.
(function () {
  try {
    const u = new URL(location.href);
    const mode = u.searchParams.get('opfs-wipe');
    const wiping = u.searchParams.get('opfs-wiping');
    const reset = u.searchParams.get('reset-db') === '1';
    if (
      !reset &&
      mode !== '1' &&
      mode !== 'park' &&
      wiping !== '1' &&
      wiping !== 'park'
    ) {
      return;
    }

    document.open();
    document.write(
      '<!doctype html><html lang="en"><head><meta charset="utf-8"/>' +
        '<meta name="viewport" content="width=device-width, initial-scale=1"/>' +
        '<title>Local database reset</title>' +
        '<style>body{font-family:system-ui,sans-serif;margin:2rem;line-height:1.4}' +
        '#status{opacity:.8}#error{color:#b00020;white-space:pre-wrap}</style>' +
        '</head><body>' +
        '<p id="status">Resetting local database...</p>' +
        '<pre id="error" hidden></pre>' +
        '</body></html>'
    );
    document.close();
    const s = document.createElement('script');
    s.src = '/sql-workers/opfs-wipe-boot.js?v=3';
    document.body.appendChild(s);
  } catch {
    // ignore
  }
})();
