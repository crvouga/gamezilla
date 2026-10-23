import '@apps/server-ts/worker';
import { runHttpInvocation } from '@pkgs/http-client-shared-ts/run-http-invocation';
import { createScopedHttpClient } from '@pkgs/http-client-shared-ts/scoped-http-client';

// A fresh runtime is essential: another test importing the product can install
// native request context and hide the cold, lazy-bootstrap failure.
const http = createScopedHttpClient({
  fetch: async (input) => new Response(String(input)),
});
const first = Promise.withResolvers<void>();
const second = Promise.withResolvers<void>();

async function request(gate: Promise<void>, path: string): Promise<string> {
  const response = await runHttpInvocation(http, async () => {
    await gate;
    const ack = await http.fetch(`https://provider.example/${path}`);
    return new Response(await ack.text());
  });
  return response.text();
}

// Finish the older request while the newer one is suspended. A stack context
// restores the older, already closed scope into the newer request here.
const a = request(first.promise, 'token');
const b = request(second.promise, 'userinfo');
first.resolve();
const token = await a;
second.resolve();
const userinfo = await b;
process.stdout.write(JSON.stringify({ token, userinfo }));
