import './reporting.steps';
import {
  type BugReportingWorld,
  bugReportingSystem,
} from '@pkgs/bug-report/harness';
import { setWorld } from '@pkgs/gherkin/registry';
import type { Run } from '@pkgs/harness';

setWorld<Run<BugReportingWorld>>({
  create: () => bugReportingSystem.run({ seed: 424242 }),
  dispose: async (world) => world[Symbol.asyncDispose](),
});
