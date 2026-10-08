import { readUtf8, writeUtf8 } from '@pkgs/object-store-root-shared/helpers';
import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';
import type { SpecEntry, SpecInventory } from './explorer-types';
import { recordExplorerVersion } from './explorer-versions';
import { isCommitSha } from './keys';

export function isSpecPath(path: string): boolean {
  return (
    path.startsWith('specs/') &&
    path
      .split('/')
      .every(
        (part) =>
          part.length > 0 &&
          part !== '.' &&
          part !== '..' &&
          !/[\\\u0000-\u001f]/.test(part)
      )
  );
}

export function specEntry(path: string, content: string): SpecEntry {
  if (!isSpecPath(path)) throw new Error('Invalid spec path');
  const file = path.split('/').at(-1) ?? path;
  const kind = file.endsWith('.openslo.yaml')
    ? 'openslo'
    : (file.split('.').at(-1) ?? 'document');
  const title =
    /^\s*Feature:\s*(.+)$/m.exec(content)?.[1] ??
    /^#\s+(.+)$/m.exec(content)?.[1] ??
    file;
  return {
    path,
    domain: path.split('/').length > 2 ? path.split('/')[1]! : 'Overview',
    kind,
    title,
  };
}

function inventoryKey(sha: string): string {
  if (!isCommitSha(sha)) throw new Error('Invalid commit');
  return `commits/${sha}/inventory.json`;
}

function documentKey(sha: string, path: string): string {
  if (!isSpecPath(path)) throw new Error('Invalid spec path');
  inventoryKey(sha);
  return `commits/${sha}/specs/${encodeURIComponent(path)}`;
}

/** Publish document bodies first; an inventory always names readable content. */
export async function publishInventory(
  store: ObjectStore,
  args: {
    readonly sha: string;
    readonly documents: readonly {
      readonly path: string;
      readonly content: string;
    }[];
  }
): Promise<SpecInventory> {
  const entries = args.documents
    .map((doc) => specEntry(doc.path, doc.content))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  if (new Set(entries.map((entry) => entry.path)).size !== entries.length)
    throw new Error('Duplicate spec');
  for (const doc of args.documents) {
    await writeUtf8(
      store,
      documentKey(args.sha, doc.path),
      doc.content,
      'text/plain; charset=utf-8'
    );
  }
  const inventory = { sha: args.sha, entries };
  await writeUtf8(
    store,
    inventoryKey(args.sha),
    JSON.stringify(inventory),
    'application/json'
  );
  await recordExplorerVersion(store, args.sha);
  return inventory;
}

export async function readInventory(
  store: ObjectStore,
  sha: string
): Promise<SpecInventory | null> {
  const raw = await readUtf8(store, inventoryKey(sha));
  if (raw === null) return null;
  const inventory = JSON.parse(raw) as SpecInventory;
  if (
    inventory.sha !== sha ||
    !Array.isArray(inventory.entries) ||
    inventory.entries.some((entry) => !isSpecPath(entry.path))
  )
    throw new Error('Invalid spec inventory');
  return inventory;
}

export async function readSpecDocument(
  store: ObjectStore,
  sha: string,
  path: string
): Promise<string | null> {
  const inventory = await readInventory(store, sha);
  if (!inventory?.entries.some((entry) => entry.path === path)) return null;
  return readUtf8(store, documentKey(sha, path));
}
