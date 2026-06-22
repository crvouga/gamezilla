import { killListenersOnPort } from '@pkgs/os/kill-port';

import { readDevIdpPortFromBinding } from './config';

killListenersOnPort(
  readDevIdpPortFromBinding(process.env['DEV_IDP_PORT'])
);
