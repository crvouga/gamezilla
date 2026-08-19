import { killListenersOnPorts } from '@pkgs/os/kill-port';
import { POSTGRES_LOCAL_PORTS } from '../src/ports';

killListenersOnPorts([...POSTGRES_LOCAL_PORTS]);
