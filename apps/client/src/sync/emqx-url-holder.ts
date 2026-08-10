/** Mutable EMQX WSS URL for sync-engine `createPubSub` (sync factory). */
export type EmqxUrlHolder = {
  url: string | null;
};

const holders = new Map<string, EmqxUrlHolder>();

export function emqxUrlHolderFor(databaseName: string): EmqxUrlHolder {
  let holder = holders.get(databaseName);
  if (holder === undefined) {
    holder = { url: null };
    holders.set(databaseName, holder);
  }
  return holder;
}

export function setEmqxUrlForDatabase(
  databaseName: string,
  url: string | null
): void {
  emqxUrlHolderFor(databaseName).url = url;
}
