import type { ApplicationEvent } from '@libs/synthetic-population-shared/application-events';
import type { Checkpoint } from '@libs/synthetic-population-shared/config';
import type { Inspection } from '@libs/synthetic-population-shared/inspection';
import type { WorkerAssignment, WorkerRenewal } from './worker-rpc';

export type SessionInput =
  | {
      type: 'start';
      assignment: WorkerAssignment;
      origin: string;
      version: string;
    }
  | { type: 'control'; renewal: WorkerRenewal; draining: boolean }
  | { type: 'activate' }
  /** The newest link from the user's internal inbox; `null` when none waits. */
  | { type: 'sign-in-link'; link: string | null }
  | { type: 'stop' };
export type SessionOutput =
  /** Only the process holding the lease can read the user's internal inbox. */
  | { type: 'sign-in-link-requested' }
  | { type: 'authenticated'; token: string }
  | {
      type: 'checkpoint';
      checkpoint: Checkpoint;
      action: string | null;
      error: string | null;
    }
  | { type: 'event'; event: ApplicationEvent }
  | { type: 'inspection'; snapshot: Inspection; requestedAt: string }
  | { type: 'command-completed'; operationId: string }
  | { type: 'closed' };
