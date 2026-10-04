import type { FeedbackReportingWorld } from '@pkgs/feedback-harness/feedback';
import { feedbackReportingSystem } from '@pkgs/feedback-harness/feedback';
import { setWorld } from '@pkgs/gherkin-shared/registry';
import type { Run } from '@pkgs/harness-root-shared/run-types';

// Every `*.steps.ts` under this folder registers itself; a new one
// needs no edit here.
const modules = new Bun.Glob('**/*.steps.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);

setWorld<Run<FeedbackReportingWorld>>({
  create: () => feedbackReportingSystem.run({ seed: 424242 }),
  dispose: async (world) => world[Symbol.asyncDispose](),
});
