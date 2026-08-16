// @io-wall-ok
import { killListenersOnPorts } from '@pkgs/os/kill-port';

import { DEFAULT_REPORT_SERVER_PORT } from '../src/types';

killListenersOnPorts([DEFAULT_REPORT_SERVER_PORT]);
