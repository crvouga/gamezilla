/**
 * Semantic DST / E2E handles shared by product UI (`testID={Handles.*}`) and
 * `@product/sim` scenario actions (`Driver` testIds). Add a handle here when a
 * control must be uniquely addressable without copy or index hacks.
 */
export const Handles = {
  // status / chrome
  statusCurrentUser: 'status-current-user',
  /** "Account" row inside the current-user avatar menu. */
  globalMenuAccount: 'global-menu-account',
  /** "Settings" row inside the global menu (→ `/more`). */
  globalMenuSettings: 'global-menu-settings',
  navBack: 'nav-back',
  tabProfile: 'tab-profile',
  tabSearch: 'tab-search',
  tabNotifications: 'tab-notifications',
  tabSpaces: 'tab-spaces',

  // spaces
  spaceCreate: 'space-create',
  /** Lobby card for a host's live space (scoped by host username). */
  spaceCard: (hostUsername: string) => `space-card-${hostUsername}`,
  spaceJoin: 'space-join',
  spaceClose: 'space-close',
  spaceLeave: 'space-leave',
  spaceEnd: 'space-end',
  spaceLeaveConfirm: 'space-leave-confirm',
  spaceEndConfirm: 'space-end-confirm',
  /** Bottom miniplayer bar while a space is open locally. */
  spaceMiniplayer: 'space-miniplayer',
  /** MutationModal success-state dismiss (Done) for space leave/end flows. */
  spaceMutationDismiss: 'space-mutation-dismiss',

  // account
  accountSignIn: 'account-sign-in',
  accountSignOut: 'account-sign-out',

  // sign-in modal
  authMethodDev: 'auth-method-dev',
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
  /** Inline "Searching…" state on the people search screen. */
  searchLoading: 'search-loading',

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
  /** Notifications Decline for an incoming friend-request modal (fromUsername). */
  notificationsFriendRequestDecline: (fromUsername: string) =>
    `notifications-friend-request-decline-${fromUsername}`,

  // chess / spaces games
  gameMenuChess: 'game-menu-chess',
  chessMenuPuzzle: 'chess-menu-puzzle',
  chessMenuStats: 'chess-menu-stats',
  chessPuzzlePlayScreen: 'chess-puzzle-play-screen',
  chessPuzzleBoardFrame: 'chess-puzzle-board-frame',
  chessPuzzleBoard: 'chess-puzzle-board',
  chessPuzzleBoardElo: 'chess-puzzle-board-elo',
  chessPuzzleExpectedUci: 'chess-puzzle-expected-uci',
  chessPuzzleE2eDebug: 'chess-puzzle-e2e-debug',
  chessPuzzleSummary: 'chess-puzzle-summary',
  chessPuzzleMoveHistory: 'chess-puzzle-move-history',
  chessPuzzleActionHint: 'chess-puzzle-action-hint',
  chessPuzzleActionNext: 'chess-puzzle-action-next',
  chessPuzzleActionRetry: 'chess-puzzle-action-retry',
  chessPuzzleActionBack: 'chess-puzzle-action-back',
  chessPuzzleActionForward: 'chess-puzzle-action-forward',
  chessStatsElo: 'chess-stats-elo',
  chessPuzzleReviewBoard: 'chess-puzzle-review-board',
  /** Career game-log row scoped by puzzle id. */
  chessGameLogRow: (puzzleId: string) => `chess-game-log-row-${puzzleId}`,
} as const;

export type Handle = {
  [K in keyof typeof Handles]: (typeof Handles)[K] extends string
    ? (typeof Handles)[K]
    : never;
}[keyof typeof Handles];
