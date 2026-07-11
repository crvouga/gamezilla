export const FriendsProfileRoute = {
  Friends: 0,
  Requests: 1,
} as const;

export type FriendsProfileRouteKey = keyof typeof FriendsProfileRoute;

export type FriendsProfileRouteValue =
  (typeof FriendsProfileRoute)[FriendsProfileRouteKey];

const FRIENDS_PROFILE_PATHS: Record<FriendsProfileRouteValue, string> = {
  [FriendsProfileRoute.Friends]: '/profile/friends',
  [FriendsProfileRoute.Requests]: '/profile/friends/requests',
};

export function friendsProfilePath(route: FriendsProfileRouteValue): string {
  return FRIENDS_PROFILE_PATHS[route];
}
