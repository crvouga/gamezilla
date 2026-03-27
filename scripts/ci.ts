import assert from 'node:assert/strict';
import { ghError } from './ci/gh';
import { main } from './ci/main';

main().catch((e: unknown) => {
  const message = e instanceof Error ? e.message : String(e);
  ghError(message);
  assert.fail(`ci.ts: unhandled error — ${message}`);
});
