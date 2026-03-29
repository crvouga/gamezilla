import assert from 'node:assert/strict';
import { ghError } from '../deployment-pipeline-cli/gh';
import { main } from '../deployment-pipeline-cli/main';

main().catch((e: unknown) => {
  const message = e instanceof Error ? e.message : String(e);
  ghError(message);
  assert.fail(`deployment-pipeline-cli: unhandled error — ${message}`);
});
