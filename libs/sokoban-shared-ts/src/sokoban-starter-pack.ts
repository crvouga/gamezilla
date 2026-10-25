import type { BundledPuzzlePack } from '@pkgs/turn-game-shared-ts/puzzle-content';

function rows(...layout: readonly string[]): string {
  return JSON.stringify({ format: 1, rows: layout });
}

/**
 * Original introductory boards, each a little harder than the last. Every
 * witness is a shortest solution in moves, checked by hand and at
 * registration.
 */
export const sokobanStarterPack: BundledPuzzlePack = {
  id: 'sokoban-starter',
  title: 'Warehouse basics',
  description:
    'Four short puzzles that teach moving the worker and pushing crates onto goals.',
  puzzles: [
    {
      id: 'sokoban-starter-1',
      title: 'First push',
      description: 'Walk up to the crate and push it onto the goal.',
      difficulty: 'Beginner',
      definition: rows('######', '#@ $.#', '#    #', '######'),
      witness: ['r', 'r'],
    },
    {
      id: 'sokoban-starter-2',
      title: 'Around the corner',
      description:
        'Push the crate down, then walk around it to push it along to the goal.',
      difficulty: 'Beginner',
      definition: rows('#####~~', '#@  #~~', '# $ ###', '#    .#', '#######'),
      witness: ['r', 'd', 'l', 'd', 'r', 'r', 'r'],
    },
    {
      id: 'sokoban-starter-3',
      title: 'Two crates',
      description: 'Push each of the two crates onto its own goal.',
      difficulty: 'Easy',
      definition: rows('######', '#.  .#', '# $$ #', '#  @ #', '######'),
      witness: ['u', 'l', 'd', 'l', 'u', 'r', 'u', 'r'],
    },
    {
      id: 'sokoban-starter-4',
      title: 'Plan ahead',
      description:
        'Think before you push: a crate in the wrong place blocks the other one.',
      difficulty: 'Medium',
      definition: rows(
        '~#####',
        '##   #',
        '#.$# #',
        '# $@ #',
        '#.  ##',
        '#####~'
      ),
      witness: [
        ...['l', 'd', 'l', 'u', 'r', 'r', 'r', 'u'],
        ...['u', 'l', 'l', 'd', 'd', 'r', 'd', 'l'],
      ],
    },
  ],
};
