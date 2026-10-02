import type { Session } from '@pkgs/harness';
import type { createExampleApp } from './example-app';

export type BoardWorld = {
  auditedMarkups: Set<string>;
  readonly session: Session;
  app: ReturnType<typeof createExampleApp>;
};
