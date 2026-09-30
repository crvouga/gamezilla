/** "Chris   Vouga" and "chris vouga" are the same person. */
export function normalizePersonName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}
