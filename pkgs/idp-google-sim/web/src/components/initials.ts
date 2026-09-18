/** First+last initial, the way the account chip and chooser avatars show it. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.charAt(0) ?? '?';
  const last = parts.length > 1 ? (parts.at(-1)?.charAt(0) ?? '') : '';
  return `${first}${last}`.toUpperCase();
}
