export function iotWireTopic(topic: string): string;

export function authorize(
  event: unknown,
  config: {
    tokenSecret: string;
    region: string;
    accountId: string;
    nowSec: number;
  }
): {
  isAuthenticated: boolean;
  principalId?: string;
  disconnectAfterInSeconds?: number;
  refreshAfterInSeconds?: number;
  policyDocuments?: unknown[];
};
