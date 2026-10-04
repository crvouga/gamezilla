import { killListenersOnPorts } from '@pkgs/os-server/kill-port';
import { EMQX_LOCAL_PORTS } from '@pkgs/emqx-shared/ports';

killListenersOnPorts([...EMQX_LOCAL_PORTS]);
