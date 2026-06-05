import { killListenersOnPorts } from '@pkgs/os/kill-port';

const API_PORT = 8788;
const INSPECTOR_PORT = 9231;

killListenersOnPorts([API_PORT, INSPECTOR_PORT]);
