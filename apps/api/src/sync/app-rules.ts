import type { AppRulesAuth } from '@libs/auth/shared/app-rules-auth';
import { AUTH_RULES } from '@libs/auth/shared/rules/rules';
import { CHESS_RULES } from '@libs/chess/shared/rules/rules';
import { FRIENDS_RULES } from '@libs/friends/shared/rules/rules';
import { PROFILE_RULES } from '@libs/profile/shared/rules/rules';
import { SPACE_RULES } from '@libs/spaces/shared/rules/rules';
import type { Rule } from '@pkgs/rules/core/types';

export const APP_RULES: readonly Rule<AppRulesAuth>[] = [
  ...AUTH_RULES,
  ...CHESS_RULES,
  ...FRIENDS_RULES,
  ...PROFILE_RULES,
  ...SPACE_RULES,
];
