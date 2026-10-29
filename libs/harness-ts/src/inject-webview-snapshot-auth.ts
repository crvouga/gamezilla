/**
 * Inject snapshot auth KV into a Bun.WebView after the origin has loaded.
 * Reload so hydrate sees the restored session.
 */

import { AUTH_BEARER_STORAGE_KEY } from '@libs/app-root-shared-ts/auth-client-storage';
import type { HarnessSystemSnapshot } from '@pkgs/harness-console-shared-ts/system-snapshot';

export async function injectWebViewSnapshotAuth(args: {
  readonly view: {
    evaluate(script: string): Promise<unknown>;
    navigate(url: string): Promise<void>;
  };
  readonly actorId: string;
  readonly snapshot: HarnessSystemSnapshot;
  readonly namespace: string;
  readonly origin: string;
}): Promise<void> {
  const slice = args.snapshot.clients[args.actorId];
  if (slice === undefined) return;
  const entries = Object.entries(slice.kv);
  if (entries.length === 0) return;
  await args.view.evaluate(
    `(function(){
      var ns = ${JSON.stringify(args.namespace)};
      var kv = ${JSON.stringify(slice.kv)};
      var bearerKey = ${JSON.stringify(AUTH_BEARER_STORAGE_KEY)};
      for (var rel in kv) {
        if (!Object.prototype.hasOwnProperty.call(kv, rel)) continue;
        var key = rel === bearerKey ? bearerKey : ns + '.' + rel;
        localStorage.setItem(key, kv[rel]);
      }
    })()`
  );
  await args.view.navigate(args.origin);
}
