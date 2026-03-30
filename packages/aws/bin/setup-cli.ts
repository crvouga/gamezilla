import { main } from '../setup-cli/main';

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
