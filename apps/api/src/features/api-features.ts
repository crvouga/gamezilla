/**
 * Public feature capabilities derived from Worker secret bindings at boot.
 * Clients use this to hide entry points for integrations that are not configured.
 */

export type ApiFeatures = {
  readonly google: boolean;
  readonly emailPassword: boolean;
  readonly stripe: boolean;
  readonly tts: boolean;
  readonly llm: boolean;
};

export function createApiFeatures(args: {
  readonly googleEnabled: boolean;
  readonly emailPasswordEnabled: boolean;
  readonly stripeConfigured: boolean;
  readonly ttsConfigured: boolean;
  readonly llmConfigured: boolean;
}): ApiFeatures {
  return {
    google: args.googleEnabled,
    emailPassword: args.emailPasswordEnabled,
    stripe: args.stripeConfigured,
    tts: args.ttsConfigured,
    llm: args.llmConfigured,
  };
}
