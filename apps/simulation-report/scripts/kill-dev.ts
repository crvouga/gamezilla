import { killListenersOnPorts } from '@pkgs/os/kill-port';

import { SIMULATION_REPORT_PORT } from './ports';

killListenersOnPorts([SIMULATION_REPORT_PORT]);
