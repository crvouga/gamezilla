import type { FeedbackReportingWorld } from '@pkgs/feedback-harness-ts/feedback';
import { feedbackReportingSystem } from '@pkgs/feedback-harness-ts/feedback';
import { setWorld } from '@pkgs/gherkin-shared-ts/registry';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';

// Every `*.steps.ts` under this folder registers itself; a new one
// needs no edit here.
const modules = new Bun.Glob('**/*.steps.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);

setWorld<Run<FeedbackReportingWorld>>({
  create: () => feedbackReportingSystem.run({ seed: 424242 }),
  dispose: async (world) => world[Symbol.asyncDispose](),
});
