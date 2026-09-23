// @io-wall-ok — local process entry for the production-shaped app stack.
import { startLocalAppStack } from './local-app-stack';

const stack = await startLocalAppStack({ profile: 'dev' });
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void stack.stop().then(() => process.exit(0));
  });
}

process.stdout.write(`\n[stack] client  ${stack.webOrigin}/\n`);
process.stdout.write(`[stack] API     ${stack.apiOrigin}/api/health\n`);
process.stdout.write('[stack] MinIO   http://127.0.0.1:9001/\n');
process.stdout.write('[stack] EMQX    http://127.0.0.1:18083/\n');
process.stdout.write('[stack] ready (Ctrl-C to stop)\n');
try {
  await stack.exited;
} finally {
  await stack.stop();
}
