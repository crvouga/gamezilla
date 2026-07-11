import type { InteractionAction } from './interaction-action';

export type InteractionCategory =
  | 'action_required'
  | 'informational'
  | 'system';

export type InteractionAvatar = {
  readonly fallbackLabel: string;
  readonly avatarConfig?: string | null;
};

export type InteractionDeepLink = {
  readonly path: string;
  readonly params?: Readonly<Record<string, string>>;
};

export type Interaction = {
  readonly id: string;
  readonly sourceNamespace: string;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly category: InteractionCategory;
  readonly title: string;
  readonly subtitle?: string;
  readonly body?: string;
  readonly createdAt: string;
  readonly priority: number;
  readonly groupKey?: string;
  readonly expiresAt?: string;
  readonly iconKey?: string;
  readonly avatar?: InteractionAvatar;
  readonly actions: readonly InteractionAction[];
  readonly deepLink?: InteractionDeepLink;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly isUnread: boolean;
  readonly isArchived: boolean;
  readonly isDismissed: boolean;
  readonly isActive: boolean;
};

export type InteractionFilter = 'all' | 'action_required' | 'archived';

export type InteractionSection = {
  readonly key: string;
  readonly title: string;
  readonly items: readonly Interaction[];
};
