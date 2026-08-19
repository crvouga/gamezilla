/**
 * Semantic DST / E2E handles shared by product UI (`testID={Handles.*}`) and
 * `@test/system` drivers (`Driver` testIds). Add a handle here when a control
 * must be uniquely addressable without copy or index hacks.
 */
export const Handles = {
  // status / chrome
  statusCurrentUser: 'status-current-user',
  navBack: 'nav-back',
  tabProfile: 'tab-profile',
  tabSearch: 'tab-search',
  tabNotifications: 'tab-notifications',

  // account
  accountSignIn: 'account-sign-in',
  accountSignOut: 'account-sign-out',

  // sign-in modal
  authMethodEmail: 'auth-method-email',
  authGoToSignUp: 'auth-go-to-sign-up',
  authEmailInput: 'auth-email-input',
  authUsernameInput: 'auth-username-input',
  authPasswordInput: 'auth-password-input',
  authConfirmPasswordInput: 'auth-confirm-password-input',
  authSubmitCreate: 'auth-submit-create',
  authSignedInDone: 'auth-signed-in-done',
  authModalClose: 'auth-modal-close',

  // sign-out mutation modal
  authSignOutConfirm: 'auth-sign-out-confirm',
  authSignedOut: 'auth-signed-out',

  // profile
  profileEdit: 'profile-edit',
  profileEditUsername: 'profile-edit-username',
  profileEditAvatar: 'profile-edit-avatar',
  profileUsernameInput: 'profile-username-input',
  profileUsernameSave: 'profile-username-save',
  profileUsernameCancel: 'profile-username-cancel',
  profileDisplayUsername: 'profile-display-username',
  profileAvatarSeed: 'profile-avatar-seed',
  profileAvatarSave: 'profile-avatar-save',
  profileAvatarCancel: 'profile-avatar-cancel',
  profileAvatarStyle: 'profile-avatar-style',
  profileAvatarStyleBottts: 'profile-avatar-style-bottts',
  profileAvatarTrait: 'profile-avatar-trait',
  profileFriendsStats: 'profile-friends-stats',

  // search
  searchInput: 'search-input',

  /** Add Friend pill scoped by peer username (search / friend-user). */
  friendAdd: (username: string) => `friend-add-${username}`,
  /** Confirm (accept incoming request) pill scoped by peer username. */
  friendConfirm: (username: string) => `friend-confirm-${username}`,
  /** Disabled Friends status pill scoped by peer username. */
  friendStatusFriends: (username: string) =>
    `friend-status-friends-${username}`,
  /** Friends list row scoped by friend username. */
  friendsListRow: (username: string) => `friends-list-row-${username}`,
  /** Notifications friend-request summary card (fromUsername). */
  notificationsFriendRequestCard: (fromUsername: string) =>
    `notifications-friend-request-card-${fromUsername}`,
  /** Notifications Accept for an incoming friend-request modal (fromUsername). */
  notificationsFriendRequestAccept: (fromUsername: string) =>
    `notifications-friend-request-accept-${fromUsername}`,
} as const;

export type Handle = {
  [K in keyof typeof Handles]: (typeof Handles)[K] extends string
    ? (typeof Handles)[K]
    : never;
}[keyof typeof Handles];
