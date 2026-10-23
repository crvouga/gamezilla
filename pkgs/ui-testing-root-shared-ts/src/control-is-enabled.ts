/** Native and accessibility flags express the same noninteractive state. */
export function controlIsEnabled(
  disabled: string | null,
  ariaDisabled: string | null
): boolean {
  return disabled === null && ariaDisabled !== 'true';
}
