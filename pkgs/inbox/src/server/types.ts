import type { InteractionAction } from '../shared/interaction-action';
import type { InteractionCategory } from '../shared/interaction';
import type { InteractionSource } from '../shared/interaction-id';

export type { StoredInteractionRow } from '../shared/stored-interaction-row';

export type InteractionPresentation = {
  readonly title: string;
  readonly subtitle?: string;
  readonly body?: string;
  readonly iconKey?: string;
  readonly avatar?: {
    readonly fallbackLabel: string;
    readonly avatarConfig?: string | null;
  };
  readonly deepLink?: {
    readonly path: string;
    readonly params?: Readonly<Record<string, string>>;
  };
};

export type PublishInteractionInput = {
  readonly userId: string;
  readonly source: InteractionSource;
  readonly category: InteractionCategory;
  readonly presentation: InteractionPresentation;
  readonly actions: readonly InteractionAction[];
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly priority?: number;
  readonly groupKey?: string;
  readonly expiresAt?: string;
};

export type UpdateInteractionInput = PublishInteractionInput;

export type DeactivateInteractionInput = {
  readonly userId: string;
  readonly source: InteractionSource;
};

export type InteractionListQuery = {
  readonly userId: string;
  readonly filter?: 'all' | 'action_required' | 'archived';
  readonly cursor?: string;
  readonly limit?: number;
};

