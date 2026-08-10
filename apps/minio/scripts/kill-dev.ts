import { killListenersOnPorts } from '@pkgs/os/kill-port';
import { MINIO_LOCAL_PORTS } from './ports';

killListenersOnPorts([...MINIO_LOCAL_PORTS]);
