import { join } from 'node:path';

export const REPO_ROOT = join(import.meta.dir, '../../../../..');
export const MODEL_DIR = join(REPO_ROOT, 'specs/system');
export const REPORT_DIR = join(
  REPO_ROOT,
  'apps/product/.cache/harness-report/models'
);
export const CLI_TIMEOUT_MS = 120_000;

// Deterministic cached gate; expanded exploration is a separate explicit command.
export const MODELS = [
  { name: 'identity-machine', samples: 200, steps: 80, verifySteps: 5 },
  { name: 'notification-machine', samples: 200, steps: 100, verifySteps: 8 },
  { name: 'membership-machine', samples: 300, steps: 100, verifySteps: 8 },
  { name: 'boundary-assumptions', samples: 300, steps: 100, verifySteps: 8 },
  { name: 'offline-replication', samples: 150, steps: 100, verifySteps: 2 },
  { name: 'access-sync', samples: 150, steps: 100, verifySteps: 2 },
  { name: 'multiplayer', samples: 150, steps: 100, verifySteps: 2 },
  { name: 'privacy-lifecycle', samples: 200, steps: 100, verifySteps: 2 },
  { name: 'whole-system', samples: 200, steps: 120, verifySteps: 2 },
  { name: 'fair-recovery', samples: 200, steps: 100, verifySteps: 8 },
  { name: 'recovery', samples: 200, steps: 120, verifySteps: 2 },
] as const;

export function modelPath(name: string): string {
  return join(MODEL_DIR, `${name}.qnt`);
}
