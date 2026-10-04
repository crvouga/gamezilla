/** Human-readable labels for Lichess puzzle theme ids. */

export function formatChessPuzzleThemeLabel(themeId: string): string {
  const spaced = themeId
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
