export function iotWireTopic(topic: string): string;

export const MAX_POLICY_DOCUMENTS: number;
export const MAX_POLICY_CHARACTERS: number;

export function authorize(
  event: unknown,
  config: {
    tokenSecret: string;
    region: string;
    accountId: string;
    nowSec: number;
    warn?: (message: string) => void;
  }
): {
  isAuthenticated: boolean;
  principalId?: string;
  disconnectAfterInSeconds?: number;
  refreshAfterInSeconds?: number;
  policyDocuments?: unknown[];
};
