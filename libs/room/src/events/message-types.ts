import type { Message as TaggedMessage } from '@gamezilla/lib/message';

/**
 * User-facing message envelope.
 *
 * INTENTIONAL: `payload` is `unknown` (not a generic). Consumers are expected to
 * narrow/validate at the boundary (e.g. in `RoomModule.handle`). This keeps
 * the transport/store layer transport-agnostic and avoids misleading TS
 * inference for LLMs/agents — validation lives in application code.
 */
export type Message = TaggedMessage;

/**
 * Domain or system event.
 *
 * INTENTIONAL: `payload` is `unknown`. System events use reserved `type`
 * prefixes such as `_peer/...` and are handled inside `Room`, not passed
 * to `RoomModule.reduce`. Domain events must be validated in `reduce`.
 */
export type Event = TaggedMessage;

/**
 * Command rejection: tagged `{ type, payload }` from `@gamezilla/lib/message`
 * creators (same wire shape as commands/events). Narrow with each tag’s `.is()`.
 */
export type RoomError = TaggedMessage;
