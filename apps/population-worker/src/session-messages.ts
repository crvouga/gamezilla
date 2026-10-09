import type { ApplicationEvent } from '@libs/population-shared/application-events';
import type { Checkpoint } from '@libs/population-shared/config';
import type { Inspection } from '@libs/population-shared/inspection';
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
  | { type: 'stop' };
export type SessionOutput =
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
