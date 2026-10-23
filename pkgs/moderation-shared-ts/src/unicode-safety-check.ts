import type { ModerationAction, StaticModerationCheck } from './check';
import { defineStaticCheck } from './check';

/** Bidi overrides / isolates: reorder what readers see (`RLO` spoofing). */
const BIDI_CONTROLS = /[‪-‮⁦-⁩]/u;
/** Zero-width and invisible characters: hide words from filters and readers. */
const INVISIBLES = /[​-‍⁠­﻿᠎]/u;
const CONTROLS = /\p{Cc}/u;
/** Stacked combining marks ("zalgo") that spill over neighbouring text. */
const MARK_STACK = /\p{M}{3,}/u;

/**
 * Refuses text that hides or distorts what it says: bidirectional overrides,
 * invisible characters, control characters and stacked combining marks.
 */
export function unicodeSafetyCheck(options: {
  readonly id: string;
  readonly version: number;
  readonly action?: ModerationAction | undefined;
}): StaticModerationCheck {
  return defineStaticCheck({
    id: options.id,
    version: options.version,
    action: options.action,
    inspect(text) {
      if (BIDI_CONTROLS.test(text)) return { code: 'bidi_control' };
      if (INVISIBLES.test(text)) return { code: 'invisible_character' };
      if (CONTROLS.test(text)) return { code: 'control_character' };
      if (MARK_STACK.test(text.normalize('NFD'))) return { code: 'mark_stack' };
      return null;
    },
  });
}
