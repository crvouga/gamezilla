import type {
  PuzzleChange,
  PuzzleContent,
  PuzzleValidation,
} from '@pkgs/turn-game-shared-ts/puzzle-content';

/**
 * A tiny Sokoban corridor: walking and pushing a box, no prescribed line,
 * colored pairs, board dimensions, sides or turns in the framework contract.
 * The fixture owns its position encoding and its own floor/goal geometry.
 */
function position(
  state: string
): { readonly person: number; readonly box: number } | null {
  if (!/^[0-4],[0-4]$/.test(state)) return null;
  const [person, box] = state.split(',').map(Number);
  if (person === undefined || box === undefined || person === box) return null;
  return { person, box };
}

const invalid: PuzzleValidation & { readonly valid: false } = {
  valid: false,
  issues: [
    {
      code: 'invalid',
      message: 'Choose the corridor and a position on its floor.',
    },
  ],
};

function apply(
  definition: string,
  state: string,
  action: string
): PuzzleChange {
  const current = position(state);
  if (
    definition !== 'corridor' ||
    current === null ||
    (action !== 'left' && action !== 'right')
  )
    return { accepted: false, issues: invalid.issues };
  const delta = action === 'left' ? -1 : 1;
  const person = current.person + delta;
  const box = person === current.box ? current.box + delta : current.box;
  if (person < 0 || person > 4 || box < 0 || box > 4)
    return {
      accepted: false,
      issues: [{ code: 'wall', message: 'A wall blocks the move.' }],
    };
  return { accepted: true, state: `${person},${box}` };
}

export const warehousePuzzleContent: PuzzleContent = {
  history: 'snapshots',
  rules: {
    validateDefinition: (definition) =>
      definition === 'corridor' ? { valid: true } : invalid,
    initial: (definition) =>
      definition === 'corridor'
        ? { accepted: true, state: '0,1' }
        : { accepted: false, issues: invalid.issues },
    validateState: (definition, state) =>
      definition === 'corridor' && position(state) !== null
        ? { valid: true }
        : invalid,
    apply,
    complete: (definition, state) =>
      definition === 'corridor' && position(state)?.box === 3,
  },
  statistics: (_definition, state) => ({
    boxOnGoal: position(state)?.box === 3,
  }),
};
