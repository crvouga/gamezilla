type Impl = (accountId: string) => Promise<void>;

let impl: Impl | null = null;

/** Called from `@gamezilla/client` when the data plane mounts. */
export function registerRemoveLocalDataForAccount(fn: Impl | null): void {
  impl = fn;
}

export async function removeLocalDataForAccount(
  accountId: string
): Promise<void> {
  if (impl === null) {
    throw new Error(
      'removeLocalDataForAccount: not registered — ClientDataPlaneProvider must mount first'
    );
  }
  await impl(accountId);
}
