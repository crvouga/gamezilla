export {
  acceptUnknownPayload,
  createMessageNamespace,
  isPlainRecord,
} from './message';
export type {
  Message,
  MessageNamespace,
  MessagePayloadValidator,
  MessageTag,
} from './message';
export { createComposedMessageRouter, createMessageRouter } from './router';
export type { ComposedMessageRouter, MessageRouter } from './router';
