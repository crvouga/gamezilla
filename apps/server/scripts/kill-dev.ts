import { killListenersOnPorts } from '@pkgs/os/kill-port';
import { DEFAULT_REPORT_SERVER_PORT } from '@pkgs/sim-console/types';

const API_PORT = 8788;
/** Matches `scripts/dev.ts` / `preview:serve` (`--inspector-port 9231`). */
const INSPECTOR_PORT = 9231;
/** Wrangler default when `--inspector-port` is omitted (stale local runs). */
const LEGACY_INSPECTOR_PORT = 9229;

killListenersOnPorts([
  API_PORT,
  DEFAULT_REPORT_SERVER_PORT,
  INSPECTOR_PORT,
  LEGACY_INSPECTOR_PORT,
]);
