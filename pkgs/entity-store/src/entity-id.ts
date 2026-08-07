/** Composite id for rows in the generic third-party mirror table. */
export function entityStoreId(
  namespace: string,
  type: string,
  externalId: string
): string {
  return `${namespace}/${type}/${externalId}`;
}
