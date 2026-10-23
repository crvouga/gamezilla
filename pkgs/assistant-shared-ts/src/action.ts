import type { Intent } from './intents';
import type { DialogueLookupKey } from './types';

export type AssistantAction =
  | {
      readonly kind: 'speak';
      readonly intent: Intent;
      readonly payloadRef: string;
      readonly dialogueKey?: DialogueLookupKey | undefined;
      readonly tags: readonly string[];
      readonly ttlMs: number;
    }
  | {
      readonly kind: 'overlay';
      readonly intent: Intent;
      readonly payloadRef: string;
      readonly tags: readonly string[];
      readonly ttlMs: number;
    }
  | {
      readonly kind: 'sfx';
      readonly intent: Intent;
      readonly payloadRef: string;
      readonly ttlMs: number;
    }
  | {
      readonly kind: 'silence';
      readonly reason: 'budget' | 'cooldown' | 'no-candidate' | 'gate';
      readonly ttlMs: number;
    };

export type AssistantSpeakAction = Extract<AssistantAction, { kind: 'speak' }>;
