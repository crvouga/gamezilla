/**
 * Foreground entry for `bun run --filter @pkgs/observability dev`.
 */
import { startObservabilityCollector } from './collector';

const collector = startObservabilityCollector();
process.stdout.write(
  `[observability-collector] listening on ${collector.url}\n`
);

let stopping = false;
async function shutdown(): Promise<void> {
  if (stopping) return;
  stopping = true;
  collector.stop();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
