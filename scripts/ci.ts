import { ghError } from './ci/gh';
import { main } from './ci/main';

main().catch((e: unknown) => {
  ghError(String(e instanceof Error ? e.message : e));
  process.exit(1);
});
