import {
  englishDataset,
  englishRecommendedTransformers,
  RegExpMatcher,
  TextCensor,
} from 'obscenity';

import type { ModerationAction, StaticModerationCheck } from './check';
import { defineStaticCheck } from './check';

let matcher: RegExpMatcher | null = null;

/** Built once, on first use: compiling the English dataset is the cost. */
function englishMatcher(): RegExpMatcher {
  matcher ??= new RegExpMatcher({
    ...englishDataset.build(),
    ...englishRecommendedTransformers,
  });
  return matcher;
}

/**
 * Profanity and slurs from the `obscenity` English dataset: confusables,
 * leetspeak and repeated letters are folded, and its whitelist keeps
 * innocent words (`Scunthorpe`, `assassin`) clean.
 */
export function obscenityCheck(options: {
  readonly id: string;
  readonly version: number;
  readonly action?: ModerationAction | undefined;
}): StaticModerationCheck {
  const hit = { code: 'profanity' } as const;
  return defineStaticCheck({
    id: options.id,
    version: options.version,
    action: options.action,
    inspect: (text) => (englishMatcher().hasMatch(text) ? hit : null),
  });
}

const censor = new TextCensor();

/** `text` with every matched span replaced by grawlix (`$*%*`). */
export function censorObscenity(text: string): string {
  const matches = englishMatcher().getAllMatches(text, true);
  return matches.length === 0 ? text : censor.applyTo(text, matches);
}
