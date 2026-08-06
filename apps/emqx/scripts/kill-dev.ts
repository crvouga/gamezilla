import { killListenersOnPorts } from '@pkgs/os/kill-port';
import { EMQX_LOCAL_PORTS } from './ports';

killListenersOnPorts([...EMQX_LOCAL_PORTS]);
