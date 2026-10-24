export function assertGameId(id: string): void {
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(id))
    throw new Error(`game id "${id}" is not a lowercase slug`);
}
