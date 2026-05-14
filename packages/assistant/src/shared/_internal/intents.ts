export const INTENT = {
  announce: 'announce',
  react: 'react',
  praise: 'praise',
  encourage: 'encourage',
  hint: 'hint',
  explain: 'explain',
  nudge: 'nudge',
  transition: 'transition',
  silence: 'silence',
} as const;

export type Intent = (typeof INTENT)[keyof typeof INTENT];

const PRIORITY: Readonly<Record<Intent, number>> = {
  [INTENT.silence]: 0,
  [INTENT.nudge]: 0.4,
  [INTENT.react]: 0.55,
  [INTENT.encourage]: 0.75,
  [INTENT.praise]: 0.85,
  [INTENT.announce]: 0.9,
  [INTENT.hint]: 0.95,
  [INTENT.explain]: 1,
  [INTENT.transition]: 0.8,
};

export function intentPriority(intent: Intent): number {
  return PRIORITY[intent] ?? 1;
}
