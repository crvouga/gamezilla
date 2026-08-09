/**
 * Foreground entry for `bun run --filter @pkgs/observability collector`.
 * Opt-in only — not wired into root `turbo dev` (noop is the default backend).
 */
import { wallIo } from '@pkgs/io';
import { startObservabilityCollector } from './collector';

const io = wallIo();
const collector = startObservabilityCollector({ now: io.clock.now });
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
