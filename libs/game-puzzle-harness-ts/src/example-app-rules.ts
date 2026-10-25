import type { PuzzleContent } from '@pkgs/turn-game-shared-ts/puzzle-content';

/** One non-grid reference puzzle: reach the target using steps of one or two. */
const targetOf = (definition: string): number | null =>
  /^target:[1-9]$/.test(definition) ? Number(definition.slice(7)) : null;
const positionOf = (state: string): number | null =>
  /^count:[0-9]$/.test(state) ? Number(state.slice(6)) : null;
const invalid = [
  {
    code: 'PUZZLE_DETAILS_INVALID',
    message: 'Choose a target from one to nine.',
  },
];

export const examplePuzzleContent: PuzzleContent = {
  rulesVersion: 1,
  history: 'snapshots',
  rules: {
    validateDefinition: (definition) =>
      targetOf(definition) !== null
        ? { valid: true }
        : { valid: false, issues: invalid },
    initial: (definition) =>
      targetOf(definition) !== null
        ? { accepted: true, state: 'count:0' }
        : { accepted: false, issues: invalid },
    validateState: (definition, state) => {
      const target = targetOf(definition);
      const position = positionOf(state);
      return target !== null && position !== null && position <= target
        ? { valid: true }
        : { valid: false, issues: invalid };
    },
    apply: (definition, state, action) => {
      const target = targetOf(definition);
      const position = positionOf(state);
      const step = action === 'step1' ? 1 : action === 'step2' ? 2 : null;
      if (
        target === null ||
        position === null ||
        step === null ||
        position + step > target
      )
        return { accepted: false, issues: invalid };
      return { accepted: true, state: `count:${position + step}` };
    },
    complete: (definition, state) =>
      targetOf(definition) !== null &&
      targetOf(definition) === positionOf(state),
  },
  statistics: (definition, state) => ({
    remaining: (targetOf(definition) ?? 0) - (positionOf(state) ?? 0),
  }),
};
