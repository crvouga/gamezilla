import assert from 'node:assert/strict';
import { ghError } from './deployment-pipeline/gh';
import { main } from './deployment-pipeline/main';

main().catch((e: unknown) => {
  const message = e instanceof Error ? e.message : String(e);
  ghError(message);
  assert.fail(`deployment-pipeline: unhandled error — ${message}`);
});
