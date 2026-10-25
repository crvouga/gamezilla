import type { ParameterTypeSpec } from '@pkgs/gherkin-shared-ts/registry';

const RIDER = 'Comet|Ember|Nova|Volt';
const HEADING = 'up|down|left|right';
const ROUNDS = { first: 1, second: 2, third: 3 } as const;

/** "Comet, Ember and Nova" → the riders, in the order written. */
function listed(text: string): string[] {
  return text.split(/, | and | or /);
}

export const PARAMETER_TYPES: readonly ParameterTypeSpec[] = [
  {
    name: 'lightCyclesRider',
    regexp: new RegExp(RIDER),
    transformer: (text: string) => text,
  },
  {
    name: 'lightCyclesRiders',
    regexp: new RegExp(`(?:${RIDER})(?:, (?:${RIDER}))* and (?:${RIDER})`),
    transformer: listed,
  },
  {
    name: 'lightCyclesHeading',
    regexp: new RegExp(HEADING),
    transformer: (text: string) => text,
  },
  {
    name: 'lightCyclesHeadings',
    regexp: new RegExp(`(?:${HEADING})(?:, (?:${HEADING}))* or (?:${HEADING})`),
    transformer: listed,
  },
  {
    name: 'lightCyclesMode',
    regexp: /Duel|Trio|Quad/,
    transformer: (text: string) =>
      text === 'Duel' ? 2 : text === 'Trio' ? 3 : 4,
  },
  {
    name: 'lightCyclesStage',
    regexp: /under way|finished|called off/,
    transformer: (text: string) => text,
  },
  {
    name: 'lightCyclesRound',
    regexp: /first|second|third/,
    transformer: (text: string) => ROUNDS[text as keyof typeof ROUNDS],
  },
  {
    // "column 19, row 10, column 20, row 9 and column 20, row 11"
    name: 'lightCyclesCells',
    regexp: /column \d+, row \d+(?:(?:, | and )column \d+, row \d+)*/,
    transformer: (text: string) =>
      [...text.matchAll(/column (\d+), row (\d+)/g)].map((cell) => ({
        column: Number(cell[1]),
        row: Number(cell[2]),
      })),
  },
  {
    // A letter key of the keyboard a rider is steered with.
    name: 'lightCyclesLetter',
    regexp: /W|A|S|D/,
    transformer: (text: string) => text,
  },
  {
    name: 'lightCyclesBotLevel',
    regexp: /easy|medium|hard/,
    transformer: (text: string) => text,
  },
];
