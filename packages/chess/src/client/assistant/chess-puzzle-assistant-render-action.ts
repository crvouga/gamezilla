import type { MessageDescriptor } from '@lingui/core';
import type { AssistantAction } from '@gamezilla/assistant/shared';

import { getChessPuzzleAssistantMessage } from './chess-puzzle-assistant-payloads';

export function renderChessPuzzleAssistantAction(
  action: AssistantAction,
  translate: (m: MessageDescriptor) => string,
  setMessage: (v: string | null) => void
): void {
  if (action.kind === 'silence') {
    setMessage('');
    return;
  }
  if (action.kind === 'speak') {
    const md = getChessPuzzleAssistantMessage(action.payloadRef);
    setMessage(md !== undefined ? translate(md) : '');
  }
}
