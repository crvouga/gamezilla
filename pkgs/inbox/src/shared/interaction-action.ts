export type InteractionAction = {
  readonly id: string;
  readonly label: string;
  readonly variant: 'solid' | 'outline' | 'ghost';
  readonly destructive?: boolean;
  readonly requiresConfirm?: boolean;
  readonly confirmTitle?: string;
  readonly confirmMessage?: string;
  readonly disabled?: boolean;
  readonly disabledReason?: string;
  readonly soundKey?: string;
};

export type InteractionCardActions = {
  readonly performAction: (
    interactionId: string,
    actionId: string
  ) => Promise<void>;
  readonly markRead: (interactionId: string) => Promise<void>;
  readonly archive: (interactionId: string) => Promise<void>;
};
