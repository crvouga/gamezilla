// @io-wall-ok — check the public hostname after edge apply and on scheduled Health runs.
import { activeEnvFile } from '@libs/infra-server-ts/worker-deploy';
import { waitForHttp } from '@libs/secrets-server-ts/wait-for-http';
import { checkAdminDeployment } from '../src/check-deployment';

const env = activeEnvFile();
await checkAdminDeployment(`https://${env.hosts.admin}`, (url) =>
  waitForHttp(url, { label: `${env.env} administration` })
);
