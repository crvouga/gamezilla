import type {
  ContentRules,
  MutationEnv,
} from '@pkgs/sync-engine-shared-ts/mutations-types';

import type { ContentKind } from './policy';

/**
 * The content rules a mutation body judges text by. Every host that runs
 * product mutations supplies them; one that did not fails here, loudly,
 * rather than saving text no rule looked at.
 */
export function contentRulesIn(env: MutationEnv): ContentRules {
  if (env.contentRules === undefined) {
    throw new Error(
      'moderation: this mutation host supplies no content rules (MutationEnv.contentRules)'
    );
  }
  return env.contentRules;
}

/** Whether the rules this write meets let `text` be saved as `kind`. */
export function allowedInMutation(
  env: MutationEnv,
  kind: ContentKind,
  text: string
): boolean {
  return contentRulesIn(env).checkWrite(kind, text).allowed;
}
