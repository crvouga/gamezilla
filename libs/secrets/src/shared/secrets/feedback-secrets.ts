import { requireNonEmpty, Secret } from './secret';

export const FEEDBACK_GITHUB_TOKEN = new Secret({
  name: 'FEEDBACK_GITHUB_TOKEN',
  hint: 'Fine-grained GitHub token with Issues write access to the feedback report repository only',
  optional: true,
  pushToApiWorker: true,
  validate: async (input) =>
    requireNonEmpty(input.secretValue, 'FEEDBACK_GITHUB_TOKEN'),
});

export const FEEDBACK_GITHUB_REPOSITORY = new Secret({
  name: 'FEEDBACK_GITHUB_REPOSITORY',
  hint: 'Destination owner/repository for hosted feedback reports',
  optional: true,
  pushToApiWorker: true,
  validate: async (input) => {
    if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(input.secretValue))
      throw new Error('Use owner/repository');
  },
});
