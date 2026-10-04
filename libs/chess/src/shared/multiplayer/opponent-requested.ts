import { createMessageNamespace, isPlainRecord } from '@pkgs/message';

const messages = createMessageNamespace('chess', 'outbox');
export const OpponentRequested = messages(
  'opponent-requested',
  (value: unknown): value is { readonly ownerId: string } =>
    isPlainRecord(value) &&
    typeof value['ownerId'] === 'string' &&
    value['ownerId'].length > 0
);
