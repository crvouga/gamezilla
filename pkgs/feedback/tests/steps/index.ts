import './feedback.steps';
import './reporting.steps';
import './wizard.steps';
import {
  type FeedbackReportingWorld,
  feedbackReportingSystem,
} from '@pkgs/feedback/harness';
import { setWorld } from '@pkgs/gherkin/registry';
import type { Run } from '@pkgs/harness';

setWorld<Run<FeedbackReportingWorld>>({
  create: () => feedbackReportingSystem.run({ seed: 424242 }),
  dispose: async (world) => world[Symbol.asyncDispose](),
});
