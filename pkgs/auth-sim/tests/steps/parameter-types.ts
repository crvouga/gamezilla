/**
 * `{actor}` and `{provider}` for this package's steps — the same patterns as
 * `SPEC_PARAMETER_TYPES` in `libs/sim-harness`, which the spec check matches
 * features with (pkgs never import libs; keep in step).
 */

import type { OauthProviderId } from '@pkgs/auth/shared';
import { defineParameterType } from '@pkgs/gherkin/registry';

const ACTOR_IDS: Readonly<Record<string, string>> = {
  Alice: 'alice',
  Bob: 'bob',
  Carol: 'carol',
  Dave: 'dave',
  Eve: 'eve',
  White: 'white',
  Black: 'black',
};

defineParameterType({
  name: 'actor',
  regexp: new RegExp(Object.keys(ACTOR_IDS).join('|')),
  transformer: (name: string) => {
    const id = ACTOR_IDS[name];
    if (id === undefined) throw new Error(`unknown actor "${name}"`);
    return id;
  },
});

defineParameterType({
  name: 'provider',
  regexp: /Google|Apple/,
  transformer: (text: string): OauthProviderId =>
    text === 'Apple' ? 'apple' : 'google',
});
