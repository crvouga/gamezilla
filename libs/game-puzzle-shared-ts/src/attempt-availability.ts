/** Shared player copy for an edition missing from the device's available scope. */
export function puzzleAvailabilityMessage(online: boolean): string {
  return online
    ? 'This puzzle is not available. Choose another available puzzle.'
    : 'Reconnect to get this puzzle. Your saved attempts are kept.';
}
