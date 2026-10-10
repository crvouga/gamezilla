// @io-wall-ok — browser composition root for the persisted network kill switch.

import { KvImplWeb } from '@pkgs/kv-web-client/impl-kv-web';
import {
  createOfflineNetworkController,
  type OfflineNetworkController,
} from './offline-network-controller';

let controller: OfflineNetworkController | null = null;

/** One browser-tab controller shared by startup services and the product env. */
export function wallOfflineNetworkController(): OfflineNetworkController {
  return (controller ??= createOfflineNetworkController(new KvImplWeb()));
}
