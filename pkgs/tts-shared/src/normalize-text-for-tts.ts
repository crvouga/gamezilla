/**
 * Normalizes coach / UI copy for TTS providers that choke on typographic
 * Unicode (em dashes, curly quotes, etc.). Display text is unchanged — call
 * this at the synthesize boundary only.
 */
export function normalizeTextForTts(text: string): string {
  return text
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\u2026/g, '...')
    .replace(/  +/g, ' ')
    .trim();
}
