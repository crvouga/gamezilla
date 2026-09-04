import { killListenersOnPort } from '@pkgs/os/kill-port';

const OBSERVABILITY_COLLECTOR_PORT = 8799;

killListenersOnPort(OBSERVABILITY_COLLECTOR_PORT);
