import { ownProfile } from './own-profile-query';
import { profilesByIds } from './profiles-by-ids-query';

export const PROFILE_QUERIES = [ownProfile, profilesByIds] as const;
