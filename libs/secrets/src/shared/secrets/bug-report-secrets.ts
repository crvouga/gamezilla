import { requireNonEmpty, Secret } from './secret';

export const BUG_REPORT_GITHUB_TOKEN = new Secret({
  name: 'BUG_REPORT_GITHUB_TOKEN',
  hint: 'Fine-grained GitHub token with Issues write access to the bug report repository only',
  optional: true,
  pushToApiWorker: true,
  validate: async (input) =>
    requireNonEmpty(input.secretValue, 'BUG_REPORT_GITHUB_TOKEN'),
});

export const BUG_REPORT_GITHUB_REPOSITORY = new Secret({
  name: 'BUG_REPORT_GITHUB_REPOSITORY',
  hint: 'Destination owner/repository for hosted bug reports',
  optional: true,
  pushToApiWorker: true,
  validate: async (input) => {
    if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(input.secretValue))
      throw new Error('Use owner/repository');
  },
});
