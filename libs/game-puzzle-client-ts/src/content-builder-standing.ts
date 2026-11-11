import type { ContentKind } from '@libs/game-puzzle-shared-ts/content-types';
import type { ContentPublicationCopyState } from './content-publication-copy-state';
import {
  type PublicationStep,
  publicationNextStep,
} from './content-publication-steps';

/**
 * Where a draft stands on its way to being published, as the builder's hub
 * says it: the one step that comes next (`puzzles`: a pack's draft puzzles
 * are published first; `fix`: the board cannot be played yet; `playtest`;
 * `validate`; `publish`), or what became of the copy that was sent
 * (`reading`, `pending`, `published`).
 */
export type ContentBuilderStanding =
  | { readonly kind: 'puzzles'; readonly waiting: readonly string[] }
  | { readonly kind: 'fix' }
  | { readonly kind: 'playtest' }
  | { readonly kind: 'validate'; readonly invalid: boolean }
  | { readonly kind: 'publish' }
  | { readonly kind: 'reading' }
  | { readonly kind: 'pending'; readonly connection: 'online' | 'offline' }
  | { readonly kind: 'published'; readonly current: boolean };

export type ContentBuilderStandingInput = {
  readonly kind: ContentKind;
  /** The saved working copy's last check; null before it is saved. */
  readonly validation: 'unchecked' | 'valid' | 'invalid' | null;
  /** A completed playtest proves this version can be finished (puzzles). */
  readonly proven: boolean;
  /** A pack's puzzles that are still drafts, by title. */
  readonly waitingOn: readonly string[];
  readonly copyState: ContentPublicationCopyState;
  /** `false` while the game cannot play the draft: correct it first. */
  readonly playable?: boolean | undefined;
};

/** The one step that comes next while the working copy is still a draft. */
export function contentBuilderNextStep(
  input: ContentBuilderStandingInput
): PublicationStep {
  if (input.copyState.kind === 'pending' || input.copyState.kind === 'edition')
    return 'publish';
  return publicationNextStep({
    validation: input.validation,
    needsProof: input.kind === 'puzzle' && !input.proven,
    waiting: input.kind === 'pack' && input.waitingOn.length > 0,
  });
}

/** What became of a copy that was sent, or `null` while it is a draft. */
function sentStanding(
  input: ContentBuilderStandingInput,
  next: PublicationStep
): ContentBuilderStanding | null {
  const copy = input.copyState;
  if (copy.kind === 'pending')
    return { kind: 'pending', connection: copy.connection };
  if (copy.kind === 'edition')
    return { kind: 'published', current: copy.current };
  // A receipt still being read only matters once publishing is the step.
  return copy.kind === 'reading' && next === 'publish'
    ? { kind: 'reading' }
    : null;
}

/** Where the draft stands, from the same facts the publish screen shows. */
export function contentBuilderStanding(
  input: ContentBuilderStandingInput
): ContentBuilderStanding {
  const next = contentBuilderNextStep(input);
  const sent = sentStanding(input, next);
  if (sent !== null) return sent;
  if (next === 'puzzles') return { kind: 'puzzles', waiting: input.waitingOn };
  if (next === 'playtest')
    return input.playable === false ? { kind: 'fix' } : { kind: 'playtest' };
  return next === 'validate'
    ? { kind: 'validate', invalid: input.validation === 'invalid' }
    : { kind: 'publish' };
}
