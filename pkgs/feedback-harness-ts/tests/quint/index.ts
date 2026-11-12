/**
 * Quint entry for this package's models (`specs/feedback/*.qnt`): registers
 * the bug reporting world and every model's binding.
 */

import type { FeedbackReportingWorld } from '@pkgs/feedback-harness-ts/feedback';
import { feedbackReportingSystem } from '@pkgs/feedback-harness-ts/feedback';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import { setQuintWorld } from '@pkgs/quint-shared-ts/registry';

// Every `*.binding.ts` under this folder registers itself; a new one
// needs no edit here.
const modules = new Bun.Glob('**/*.binding.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);

setQuintWorld<Run<FeedbackReportingWorld>>({
  create: () => feedbackReportingSystem.run({ seed: 424242 }),
  dispose: (w) => w[Symbol.asyncDispose](),
});
