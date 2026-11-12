// The harness's vendor emulators run inside the page, not on a server, so
// nothing answers at an address a frame could load one's dashboard from.
// This worker gives them addresses: a request under /__emulators/<page>/<id>/
// is handed to the page that owns <page>, which asks the emulator and hands
// the answer back. It touches no other request.
//
// Plain JavaScript on purpose: it is served as it is, from the site root, so
// its scope is the whole site.

const PREFIX = '/__emulators/';
/** Where every emulator serves its administration. */
const ADMIN_PREFIX = '/__admin';
const ANSWER_WITHIN_MS = 15000;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/** `{ page, emulator, path }` of an address under the prefix, else `null`. */
function target(pathname) {
  if (!pathname.startsWith(PREFIX)) return null;
  const [page, emulator, ...rest] = pathname.slice(PREFIX.length).split('/');
  if (!page || !emulator) return null;
  return { page, emulator, path: `/${rest.join('/')}` };
}

/**
 * A dashboard asks for its API by absolute path (`/__admin/...`), which is
 * outside the prefix: such a request belongs to the emulator whose frame
 * made it.
 */
async function targetOf(event) {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return null;
  const direct = target(url.pathname);
  if (direct !== null) return direct;
  const client = event.clientId
    ? await self.clients.get(event.clientId)
    : undefined;
  const from = client ? target(new URL(client.url).pathname) : null;
  return from === null ? null : { ...from, path: url.pathname };
}

function unavailable(status, text) {
  return new Response(text, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

async function ask(request, to) {
  const url = new URL(request.url);
  const body =
    request.method === 'GET' || request.method === 'HEAD'
      ? null
      : await request.arrayBuffer();
  const pages = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });
  const question = {
    type: 'harness-emulator-request',
    page: to.page,
    emulator: to.emulator,
    method: request.method,
    path: `${to.path}${url.search}`,
    headers: [...request.headers],
    body,
  };
  // Every page hears it, each on a line of its own; only the page that owns
  // `page` answers.
  const answer = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ANSWER_WITHIN_MS);
    for (const page of pages) {
      const channel = new MessageChannel();
      channel.port1.onmessage = (message) => {
        clearTimeout(timer);
        resolve(message.data);
      };
      page.postMessage(question, [channel.port2]);
    }
    if (pages.length === 0) resolve(null);
  });
  if (answer === null || answer === undefined)
    return unavailable(504, 'The harness page did not answer.');
  const headers = new Headers(answer.headers);
  // The harness page is cross-origin isolated; a frame it embeds must be too.
  headers.set('cross-origin-embedder-policy', 'require-corp');
  headers.set('cross-origin-resource-policy', 'same-origin');
  headers.set('cache-control', 'no-store');
  return new Response(answer.body, { status: answer.status, headers });
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // Decided without waiting when the address says so; a dashboard's own API
  // calls need its frame looked up first.
  const direct = target(url.pathname);
  if (direct !== null) {
    event.respondWith(ask(event.request, direct));
    return;
  }
  // Nothing else of the site is touched: only an administration path can be
  // a dashboard's call home.
  if (!event.clientId || !url.pathname.startsWith(ADMIN_PREFIX)) return;
  event.respondWith(
    targetOf(event).then((to) =>
      to === null ? fetch(event.request) : ask(event.request, to)
    )
  );
});
