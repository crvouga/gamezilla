import type { InteractionAction } from '../shared/interaction-action';
import type { InteractionCategory } from '../shared/interaction';
import type { InteractionSource } from '../shared/interaction-id';

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

export type StoredInteractionRow = {
  readonly id: string;
  readonly user_id: string;
  readonly source_namespace: string;
  readonly source_type: string;
  readonly source_id: string;
  readonly category: InteractionCategory;
  readonly priority: number;
  readonly group_key: string | null;
  readonly title: string;
  readonly subtitle: string | null;
  readonly body: string | null;
  readonly icon_key: string | null;
  readonly avatar_fallback_label: string | null;
  readonly avatar_config: string | null;
  readonly deep_link_path: string | null;
  readonly deep_link_params: unknown;
  readonly actions: unknown;
  readonly payload: unknown;
  readonly expires_at: string | null;
  readonly read_at: string | null;
  readonly archived_at: string | null;
  readonly dismissed_at: string | null;
  readonly active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
};
