import { EMQX_LOCAL_PORTS } from '@pkgs/emqx-shared/ports';
import { killListenersOnPorts } from '@pkgs/os-server/kill-port';

killListenersOnPorts([...EMQX_LOCAL_PORTS]);
