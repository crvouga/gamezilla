const HEADER =
  'PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags';
const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FILES = 'abcdefgh';

export function importFixture(sequence: number, broken = false): string {
  const rows = Array.from({ length: 3 }, (_, index) => {
    const variant = sequence * 3 + index;
    const white = FILES[variant % 8];
    const black = FILES[Math.floor(variant / 8) % 8];
    return `load-${sequence}-${index},${FEN},${broken ? 'a1a8 a7a6' : `${white}2${white}3 ${black}7${black}6`},1400,80,100,43,middlegame short,,`;
  });
  if (broken) return `${HEADER}\n${rows.join('\n')}\n`;
  // Two real upload parts: the first reports progress; the second completes it.
  // Repeated positions with different IDs do not add copies or update earlier rows.
  rows.push(`broken-a,${FEN},a1a8 a7a6,1400,80,100,43,middlegame,,`);
  rows.push(`broken-b,${FEN},h1h8 a7a6,1400,80,100,43,middlegame,,`);
  const first = rows[0] ?? '';
  for (let index = 0; index < 246; index++)
    rows.push(first.replace(/^load-[^,]+/, `copy-${sequence}-${index}`));
  return `${HEADER}\n${rows.join('\n')}\n`;
}
