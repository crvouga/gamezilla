import { AUTH_RULES } from '@pkgs/rules/auth/rules';
import { CHESS_RULES } from '@pkgs/rules/chess/rules';
import { FRIENDS_RULES } from '@pkgs/rules/friends/rules';
import { PROFILE_RULES } from '@pkgs/rules/profile/rules';
import { SPACE_RULES } from '@pkgs/rules/spaces/rules';

export const APP_RULES = [
  ...AUTH_RULES,
  ...CHESS_RULES,
  ...FRIENDS_RULES,
  ...PROFILE_RULES,
  ...SPACE_RULES,
];
