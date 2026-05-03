import type { Message } from '../events/message-types';

export type Command = {
  id: string;
  seq: number;
  peerId: string;
  message: Message;
};
