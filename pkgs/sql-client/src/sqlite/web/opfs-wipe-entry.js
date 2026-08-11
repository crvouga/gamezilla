// @io-wall-ok — index.html entry: redirect wipe/reset to static wipe document before Expo.
(function () {
  try {
    const u = new URL(location.href);
    const mode = u.searchParams.get('opfs-wipe');
    const reset = u.searchParams.get('reset-db') === '1';
    if (!reset && mode !== '1' && mode !== 'park') {
      return;
    }

    const wipe = new URL('/sql-workers/opfs-wipe.html', location.origin);
    wipe.searchParams.set('opfs-wipe', mode === 'park' ? 'park' : '1');

    if (reset) {
      u.searchParams.delete('reset-db');
      u.searchParams.delete('opfs-wipe');
      u.searchParams.delete('parked');
      u.searchParams.delete('return');
      const ret =
        u.pathname +
        (u.searchParams.toString() ? `?${u.searchParams.toString()}` : '') +
        u.hash;
      wipe.searchParams.set(
        'return',
        ret.startsWith('/') && !ret.startsWith('//') ? ret || '/' : '/'
      );
    } else {
      const ret = u.searchParams.get('return') || '/';
      wipe.searchParams.set(
        'return',
        ret.startsWith('/') &&
          !ret.startsWith('//') &&
          !ret.includes('opfs-wipe') &&
          !ret.includes('reset-opfs')
          ? ret
          : '/'
      );
    }

    location.replace(wipe.pathname + wipe.search);
  } catch {
    // ignore
  }
})();
