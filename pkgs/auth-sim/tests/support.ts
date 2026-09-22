import type { OauthProviderId } from '@pkgs/auth/shared';
import type { ProviderAnswers, ProviderStepArgs } from '@pkgs/auth-sim';

export function as(
  email: string,
  extra: Partial<ProviderAnswers> = {}
): ProviderAnswers {
  return { email, consent: 'allow', emailChoice: 'share', ...extra };
}

export function step(
  clientId: string,
  provider: OauthProviderId,
  email: string,
  extra: Partial<ProviderAnswers> = {}
): ProviderStepArgs {
  return { clientId, provider, answers: as(email, extra) };
}
