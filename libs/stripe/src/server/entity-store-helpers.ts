export function patchEntityTypeToEntityStoreType(entityType: string): string {
  return entityType.startsWith('stripe.')
    ? entityType.slice('stripe.'.length)
    : entityType;
}

export function stripeEntityStoreData(attrs: Record<string, unknown>): string {
  return JSON.stringify(attrs);
}
