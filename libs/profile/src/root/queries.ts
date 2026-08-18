import { ownProfile } from '../use-cases/hydrate-own-profile/shared/own-profile-query';
import { profilesByIds } from '../use-cases/hydrate-profiles-by-ids/shared/profiles-by-ids-query';

export const PROFILE_QUERIES = [ownProfile, profilesByIds] as const;
