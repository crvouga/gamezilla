// @io-wall-ok — release the admin Worker and its matching static client together.
import { join } from 'node:path';
import { deployAdminWorker } from '@libs/infra-server-ts/worker-deploy';
import {
  hyperdriveId,
  workerSecrets,
} from '@libs/secrets-server-ts/worker-secrets';

deployAdminWorker({
  appDir: join(import.meta.dirname, '..'),
  secrets: await workerSecrets('admin'),
  hyperdriveId: hyperdriveId(),
});
