/** A device needs its own policy predicates, never another account's roster entry. */
export function clientPermissionPolicy(
  value: unknown,
  accountId: string | null
): string {
  try {
    const policy: unknown =
      typeof value === 'string' ? JSON.parse(value) : value;
    return (
      JSON.stringify(policy, (key, predicate: unknown) => {
        if (key !== 'accountId' || predicate === null) return predicate;
        if (accountId === null) return [];
        return predicate === accountId ||
          (Array.isArray(predicate) && predicate.includes(accountId))
          ? [accountId]
          : [];
      }) ?? 'null'
    );
  } catch {
    return 'null';
  }
}
