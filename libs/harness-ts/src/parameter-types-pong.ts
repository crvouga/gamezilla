import type { ParameterTypeSpec } from '@pkgs/gherkin-shared-ts/registry';

export const PARAMETER_TYPES: readonly ParameterTypeSpec[] = [
  {
    name: 'pongPaddle',
    regexp: /left|right/,
    transformer: (text: string) => text,
  },
  {
    name: 'pongStage',
    regexp: /counting down|in play|finished/,
    transformer: (text: string) => text,
  },
  {
    name: 'pongLocalStage',
    regexp: /ready to start|under way|finished/,
    transformer: (text: string) =>
      text === 'ready to start'
        ? 'ready'
        : text === 'under way'
          ? 'playing'
          : 'finished',
  },
  {
    name: 'pongLocalOpponent',
    regexp: /Bob|a Pong bot/,
    transformer: (text: string) => (text === 'Bob' ? 'person' : 'bot'),
  },
  {
    name: 'pongPaddles',
    regexp: /both paddles|only the left paddle|only the right paddle/,
    transformer: (text: string) =>
      text === 'both paddles'
        ? ['left', 'right']
        : text === 'only the left paddle'
          ? ['left']
          : ['right'],
  },
  {
    name: 'pongPlace',
    regexp: /middle|upper edge|lower edge/,
    transformer: (text: string) => text,
  },
];
