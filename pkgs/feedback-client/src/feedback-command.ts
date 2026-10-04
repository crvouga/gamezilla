import type { Command } from '@pkgs/ui-client/types';
import { requestFeedback } from './open-feedback';

export function feedbackCommand(labels: {
  title: string;
  category: string;
}): Command {
  return {
    id: 'feedback-open',
    title: labels.title,
    category: labels.category,
    keywords: ['feedback', 'bug', 'draft', 'report'],
    run: () => requestFeedback(),
  };
}
