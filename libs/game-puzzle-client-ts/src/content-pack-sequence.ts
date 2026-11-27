const TRAILING_NUMBER = /(?:^|\s)0*(\d+)$/;

/**
 * Whether a pack's puzzles are an ordered numbered sequence, such as
 * `Dock 01`, `Dock 02`, … or `Level 3`: every title ends in the number of its
 * own place, counting from 1. Then a number alone names each puzzle. A pack
 * of named puzzles (`Count to five`) or titles that skip or repeat a place
 * is no sequence: its puzzles need their names.
 */
export function isNumberedSequence(titles: readonly string[]): boolean {
  return (
    titles.length > 0 &&
    titles.every((title, index) => {
      const match = TRAILING_NUMBER.exec(title.trim());
      return match !== null && Number(match[1]) === index + 1;
    })
  );
}
