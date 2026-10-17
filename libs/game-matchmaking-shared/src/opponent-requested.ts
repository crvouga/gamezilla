import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared/message';
import { GAME_PLATFORM_NAMESPACE } from './durable-names';

const messages = createMessageNamespace(GAME_PLATFORM_NAMESPACE, 'outbox');
export const OpponentRequested = messages(
  'opponent-requested',
  (value: unknown): value is { readonly ownerId: string } =>
    isPlainRecord(value) &&
    typeof value['ownerId'] === 'string' &&
    value['ownerId'].length > 0
);
