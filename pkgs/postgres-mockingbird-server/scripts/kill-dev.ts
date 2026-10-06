import { killListenersOnPorts } from '@pkgs/os-server/kill-port';
import { POSTGRES_LOCAL_PORTS } from '@pkgs/postgres-local-shared/ports';

killListenersOnPorts([...POSTGRES_LOCAL_PORTS]);
