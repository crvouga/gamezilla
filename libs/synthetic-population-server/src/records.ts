import type {
  Checkpoint,
  SyntheticPopulationConfig,
} from '@libs/synthetic-population-shared/config';
import type { Clock } from '@pkgs/clock-shared/types';
import type { CreateId } from '@pkgs/uuid-shared/create-id';
import { z } from 'zod';

export type SyntheticPopulationPorts = {
  readonly clock: Clock;
  readonly createId: CreateId;
  readonly notify: () => Promise<void>;
};
export type UserRecord = {
  id: string;
  account_id: string | null;
  username: string;
  region: string;
  paused: boolean;
  worker_id: string | null;
  generation: number;
  lease_until: string | null;
  activity: string;
  checkpoint: Checkpoint | null;
  application_version: string | null;
  last_action: string | null;
  last_error: string | null;
  inspection_requested_at: string | null;
  inspection: unknown;
  created_at: string;
  updated_at: string;
};
export type WorkerRecord = {
  id: string;
  application_version: string;
  capacity: number;
  draining: boolean;
  heartbeat_at: string;
  memory_bytes: number | null;
  cpu_milliseconds: number | null;
  lease_failures: number;
};
export type EventRecord = {
  id: string;
  user_id: string | null;
  worker_id: string | null;
  generation: number;
  application_version: string | null;
  correlation_id: string;
  event: string;
  context: unknown;
  created_at: string;
};
export type Lease = {
  userId: string;
  workerId: string;
  generation: number;
  expiresAt: string;
};
export type ConfigurationRecord = {
  value: SyntheticPopulationConfig | string;
  revision: number;
};
export const workerHeartbeatSchema = z.object({
  workerId: z.string().uuid(),
  version: z.string().min(1).max(128),
  capacity: z.number().int().min(1).max(32),
  draining: z.boolean(),
  memoryBytes: z.number().int().nonnegative().nullable(),
  cpuMilliseconds: z.number().int().nonnegative().nullable(),
  leaseFailures: z.number().int().nonnegative(),
});
export type WorkerHeartbeat = z.infer<typeof workerHeartbeatSchema>;
export const leaseSchema = z.object({
  userId: z.string().uuid(),
  workerId: z.string().uuid(),
  generation: z.number().int().positive(),
});

export function jsonValue(value: unknown): unknown {
  return typeof value === 'string' ? (JSON.parse(value) as unknown) : value;
}
export function isoAt(ms: number): string {
  return new Date(ms).toISOString();
}
