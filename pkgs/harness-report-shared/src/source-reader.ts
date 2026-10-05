import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';
import type { BundleEntry } from './bundle';
import { bundleIndexKey, createBundleReader, readBundleIndex } from './bundle';

export async function sourceReader(
  store: ObjectStore,
  args: { sha: string; source: string }
) {
  const index = await readBundleIndex(
    store,
    bundleIndexKey(args.sha, args.source)
  );
  if (Object.keys(index).length > 0) return createBundleReader(store, index);
  // Existing stored reports remain readable while writers use bundles.
  return async (key: string): Promise<BundleEntry | null> => {
    const obj = await store.get(key);
    return obj === null
      ? null
      : {
          key,
          contentType: obj.contentType,
          bytes: new Uint8Array(await new Response(obj.body).arrayBuffer()),
        };
  };
}
