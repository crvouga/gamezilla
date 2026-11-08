/** SQL LIKE pattern for a literal, case-insensitive username prefix. */
export function usernamePrefix(query: string): string {
  return `${query.trim().toLowerCase().replace(/[!%_]/g, '!$&')}%`;
}
