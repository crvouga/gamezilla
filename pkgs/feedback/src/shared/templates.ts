import type { FeedbackKind } from './types';
export const FEEDBACK_TEMPLATES: readonly {
  kind: FeedbackKind;
  label: string;
  body: string;
}[] = [
  {
    kind: 'problem',
    label: 'Bug',
    body: '## What happened\n\n\n## What was expected\n\n\n## Reproduction steps\n\n1. \n',
  },
  {
    kind: 'feature',
    label: 'Feature request',
    body: '## The opportunity\n\n\n## Intended improvement\n\n\n## Why it matters\n\n',
  },
  {
    kind: 'gap',
    label: 'Gap',
    body: '## What is missing\n\n\n## Intended improvement\n\n',
  },
  {
    kind: 'polish',
    label: 'Polish',
    body: '## What could feel better\n\n\n## Intended improvement\n\n',
  },
];
