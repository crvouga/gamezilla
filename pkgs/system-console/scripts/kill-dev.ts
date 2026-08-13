import { killListenersOnPorts } from '@pkgs/os/kill-port';

import { SYSTEM_CONSOLE_PORT } from './ports';

killListenersOnPorts([SYSTEM_CONSOLE_PORT]);
