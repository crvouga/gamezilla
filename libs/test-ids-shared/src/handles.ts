/**
 * Semantic DST / spec handles shared by product UI (`testID={Handles.*}`) and
 * `@apps/product/harness` scenario actions (`Driver` testIds). Add a handle here when a
 * control must be uniquely addressable without copy or index hacks.
 */
export const Handles = {
  // status / chrome
  /** Full-bleed boot canvas while identity binds or local SQLite opens. */
  bootLoading: 'boot-loading',
  statusCurrentUser: 'status-current-user',
  statusWorkOffline: 'status-work-offline',
  /** "Account" row inside the current-user avatar menu. */
  globalMenuAccount: 'global-menu-account',
  /** "Settings" row inside the global menu (→ `/more`). */
  globalMenuSettings: 'global-menu-settings',
  /** "An update is needed" banner: the product no longer accepts this app. */
  appUpdateRequired: 'app-update-required',
  /** Not-found screen for an address the app does not have (`-action`: Go to Spaces). */
  routeNotFound: 'route-not-found',
  routeNotFoundAction: 'route-not-found-action',

  // settings
  settingsTheme: 'settings-theme',
  settingsSound: 'settings-sound',
  settingsWorkOffline: 'settings-work-offline',
  settingsWorkOfflineSwitch: 'settings-work-offline-switch',
  commandPalette: 'command-palette',
  commandPaletteInput: 'command-palette-input',
  settingsAbout: 'settings-about',
  /** Appearance picker option (`light` / `dark` / `system`). */
  themeOption: (key: 'light' | 'dark' | 'system') => `theme-option-${key}`,
  soundEffectsSwitch: 'sound-effects-switch',
  /** Version row on the About screen. */
  aboutVersion: 'about-version',
  navBack: 'nav-back',
  tabProfile: 'tab-profile',
  tabSearch: 'tab-search',
  tabNotifications: 'tab-notifications',
  tabSpaces: 'tab-spaces',
  /** The harness's bare home tab, in compositions where no sub owns `/`. */
  tabHarnessHome: 'tab-harness-home',

  // spaces
  spaceCreate: 'space-create',
  /** Lobby card for a host's live space (scoped by host username). */
  spaceCard: (hostUsername: string) => `space-card-${hostUsername}`,
  /** One retained lobby card, even before its host's profile is available. */
  spaceLobbyCard: (spaceId: string) => `space-lobby-card-${spaceId}`,
  spaceJoin: 'space-join',
  spaceJoinPrompt: 'space-join-prompt',
  spaceEnded: 'space-ended',
  spaceHostOffline: 'space-host-offline',
  spaceClose: 'space-close',
  /** Space chrome overflow trigger — actions that do not fit collapse here. */
  spaceChromeOverflow: 'space-chrome-overflow-menu',
  spaceLeave: 'space-leave',
  spaceEnd: 'space-end',
  spaceLeaveConfirm: 'space-leave-confirm',
  spaceEndConfirm: 'space-end-confirm',
  spaceShare: 'space-share',
  spaceShareClose: 'space-share-close',
  spaceAddTrigger: 'space-add-trigger',
  spaceAddQuery: 'space-add-query',
  spaceAddPerson: (memberId: string) => `space-add-person-${memberId}`,
  spaceAddSuccess: 'space-add-success',
  spaceRemovePerson: (memberId: string) => `space-remove-person-${memberId}`,
  spaceRemoveConfirm: 'space-remove-confirm',
  spaceRemoveSuccess: 'space-remove-success',
  /** Bottom miniplayer bar while a space is open locally. */
  spaceMiniplayer: 'space-miniplayer',
  spaceMiniplayerOpen: (spaceId: string) => `space-miniplayer-open-${spaceId}`,
  /** MutationModal success-state dismiss (Done) for space leave/end flows. */
  spaceMutationDismiss: 'space-mutation-dismiss',
  /** Members button in the space action bar. */
  spaceMembersButton: 'space-members-button',
  /** Presence strip (member faces) in the space action bar. */
  spacePresenceStrip: 'space-presence-strip',
  /** One row in the space members list modal, scoped by member id. */
  spaceMemberRow: (memberId: string) => `space-member-row-${memberId}`,
  spaceMemberName: (memberId: string) => `space-member-name-${memberId}`,
  /** Hidden count probe in the space members modal. */
  spacePresenceCount: 'space-presence-count',
  /** Idle badge on one person in the members list. */
  spaceMemberIdle: (memberId: string) => `space-member-idle-${memberId}`,
  /** Hidden people the space is counting, one profile id per line. */
  spacePresencePeople: 'space-presence-people',
  /** Hidden people shown as idle, one profile id per line. */
  spacePresenceIdle: 'space-presence-idle',
  /** Hidden room client id the quiet timer belongs to. */
  spaceQuietClient: 'space-quiet-client',
  /** The connection is missing, for someone already in a space. */
  connectionMissing: 'connection-missing',
  /** A guest tried to choose the space's game. */
  gameChoiceRefused: 'game-choice-refused',
  /**
   * How many live spaces this device counts, including while a space is open.
   * The lobby paragraph is {@link spacesHostingCount}.
   */
  spacesHostedProbe: 'spaces-hosted-probe',
  /** Close control of the space members modal. */
  spaceMembersClose: 'space-members-close',
  /** How many live spaces the viewer hosts, on the Spaces screen. */
  spacesHostingCount: 'spaces-hosting-count',
  /**
   * The Spaces list has read its local hosting count, including zero.
   * Absent while local data is loading.
   */
  spacesListReady: 'spaces-list-ready',
  /** Spaces screen / link: this needs a connection. */
  spacesNeedConnection: 'spaces-need-connection',
  /** Spaces screen: the hosting limit's invitation to Plus. */
  spacesHostingLimit: 'spaces-hosting-limit',
  /** A space link that leads nowhere. */
  spaceNotFound: 'space-not-found',
  /** Its way back to Spaces (the EmptyState action of `spaceNotFound`). */
  spaceNotFoundBack: 'space-not-found-action',
  /** The space's name in its chrome. */
  spaceTitle: 'space-title',
  /** Rename action in the space chrome (host only). */
  spaceRename: 'space-rename',
  spaceRenameInput: 'space-rename-input',
  spaceRenameConfirm: 'space-rename-confirm',
  /** The rename dialog says the typed space name is not allowed. */
  spaceRenameNotAllowed: 'space-rename-not-allowed',
  spaceRenameCancel: 'space-rename-cancel',
  /** Cancel outgoing friend request pill (scoped by username). */
  friendCancel: (username: string) => `friend-cancel-${username}`,
  /** Decline incoming friend request pill (scoped by username). */
  friendDecline: (username: string) => `friend-decline-${username}`,
  /** Remove friend pill (scoped by username). */
  friendRemove: (username: string) => `friend-remove-${username}`,
  /** Remove friend dialog: keep the friend (scoped by username). */
  friendRemoveCancel: (username: string) => `friend-remove-cancel-${username}`,
  /** Remove friend confirmation button (scoped by username). */
  friendRemoveConfirm: (username: string) =>
    `friend-remove-confirm-${username}`,
  /** Block user pill (scoped by username). */
  friendBlock: (username: string) => `friend-block-${username}`,
  /** Block user confirmation (scoped by username). */
  friendBlockConfirm: (username: string) => `friend-block-confirm-${username}`,
  /** Unblock user pill (scoped by username). */
  friendUnblock: (username: string) => `friend-unblock-${username}`,
  /** The @handle heading on another person's profile screen. */
  friendUserUsername: 'friend-user-username',
  /** "No friends yet" empty state on the friends list (`-action`: Find friends). */
  friendsEmpty: 'friends-empty',

  // account
  accountSignIn: 'account-sign-in',
  accountSignOut: 'account-sign-out',
  /** "Sign out of all devices". */
  accountSignOutEverywhere: 'account-sign-out-everywhere',
  accountSignOutEverywhereConfirm: 'account-sign-out-everywhere-confirm',
  accountSignOutEverywhereDone: 'account-sign-out-everywhere-done',
  /** The "Sign-in methods" section and its rows / actions, per provider. */
  accountSignInMethods: 'account-sign-in-methods',
  accountSignInMethod: (provider: string) =>
    `account-sign-in-method-${provider}`,
  accountLinkProvider: (provider: string) =>
    `account-link-provider-${provider}`,
  accountUnlinkProvider: (provider: string) =>
    `account-unlink-provider-${provider}`,
  accountUnlinkConfirm: 'account-unlink-confirm',
  accountUnlinkDone: 'account-unlink-done',
  /** The account screen's "Devices" row. */
  accountDevices: 'account-devices',
  /** "2 devices" above the devices list. */
  accountDevicesCount: 'account-devices-count',
  /** The devices screen's guest state (`-action`: Sign in). */
  accountDevicesSignIn: 'account-devices-sign-in',
  /** One row of the devices list, by device id. */
  accountDevice: (deviceId: string) => `account-device-${deviceId}`,
  /** The "This device" mark inside a device row. */
  accountDeviceCurrent: 'account-device-current',

  // billing
  settingsBilling: 'settings-billing',
  billingScreen: 'billing-screen',
  billingTier: 'billing-tier',
  billingSubscribe: 'billing-subscribe',
  billingManage: 'billing-manage',
  billingUnlock: 'billing-unlock',
  billingStatus: 'billing-status',
  /** Plus credit left on the billing screen, with `data-credit-cents`. */
  billingCredit: 'billing-credit',
  billingNotice: 'billing-notice',
  billingPricing: 'billing-pricing',
  billingPrice: (priceKey: string) => `billing-price-${priceKey}`,
  /** Inside a price: its amount, its terms line, and its saving badge. */
  billingPriceAmount: 'billing-price-amount',
  billingPriceTerms: 'billing-price-terms',
  billingPriceSaving: 'billing-price-saving',
  billingBenefits: 'billing-benefits',

  // sign-in modal
  authMethodGoogle: 'auth-method-google',
  authMethodApple: 'auth-method-apple',
  /**
   * "Continue with email": opens the emailed-link form in its own surface.
   * Rendered only on a Synthetic User's application host.
   */
  authMethodEmail: 'auth-method-email',
  /** Emailed-link form, first step: the address and "Email me a link". */
  authEmailAddress: 'auth-email-address',
  authEmailRequestLink: 'auth-email-request-link',
  /** Second step ("Check your email"): the pasted link and "Sign in". */
  authEmailLink: 'auth-email-link',
  authEmailSignIn: 'auth-email-sign-in',
  /** Second step → back to the first, to use a different address. */
  authEmailChangeAddress: 'auth-email-change-address',
  /** The modal's settled face after an attempt: signed in, or failed. */
  authSignInOutcome: 'auth-sign-in-outcome',
  /** The modal's "Sign-in failed" face (cancelled, provider error, …). */
  authSignInFailed: 'auth-sign-in-failed',
  /** "Connect your accounts": prove the matched account, or keep apart. */
  authLinkRequired: 'auth-link-required',
  authLinkWith: (provider: string) => `auth-link-with-${provider}`,
  authLinkSeparate: 'auth-link-separate',
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
  profileUsernamePending: 'profile-username-pending',
  profileUsernameRefusal: 'profile-username-refusal',
  profileDisplayUsername: 'profile-display-username',
  /** The profile tells its person which stand-in name others see them by. */
  profileStandInNotice: 'profile-stand-in-notice',
  profileAvatarSeed: 'profile-avatar-seed',
  profileAvatarSave: 'profile-avatar-save',
  profileAvatarCancel: 'profile-avatar-cancel',
  /** "Discard changes?" → Discard, after Cancel on an edited avatar. */
  profileAvatarDiscardConfirm: 'profile-avatar-discard-confirm',
  /** "Discard changes?" → keep editing. */
  profileAvatarDiscardKeep: 'profile-avatar-discard-keep',
  profileAvatarStyle: 'profile-avatar-style',
  profileAvatarStyleSearch: 'profile-avatar-style-search',
  /** One option in the avatar style picker, by style key (e.g. `bottts`). */
  profileAvatarStyleOption: (styleKey: string) =>
    `profile-avatar-style-${styleKey}`,
  profileAvatarTrait: 'profile-avatar-trait',
  profileFriendsStats: 'profile-friends-stats',
  /** The number in the Profile tab's friends stat row. */
  profileFriendsCount: 'profile-friends-count',

  // search
  searchInput: 'search-input',
  /** Inline "Searching…" state on the people search screen. */
  searchLoading: 'search-loading',
  /** People search result row scoped by the found user's username. */
  searchUserResult: (username: string) => `search-user-result-${username}`,
  /** Any rendered people-search row, once the list has actually painted one. */
  searchResultRow: 'search-result-row',
  /** The pressable identity in a people search result (opens their profile). */
  searchUserResultOpen: (username: string) =>
    `search-user-result-open-${username}`,
  /** The list of people a settled search found. */
  searchResults: 'search-results',
  /** "No people found" state for a settled search. */
  searchEmpty: 'search-empty',
  /** Signed-out prompt in place of people results (`-action`: Sign in). */
  searchDenied: 'search-denied',
  /** In place of results for a search made offline: search needs a connection. */
  searchNeedsConnection: 'search-needs-connection',

  /** Add Friend pill scoped by peer username (search / friend-user). */
  friendAdd: (username: string) => `friend-add-${username}`,
  /** Why an Add did nothing offline: friend requests need a connection. */
  friendRequestPending: 'friend-request-pending',
  friendRequestRefusal: 'friend-request-refusal',
  /** Confirm (accept incoming request) pill scoped by peer username. */
  friendConfirm: (username: string) => `friend-confirm-${username}`,
  /** Disabled Friends status pill scoped by peer username. */
  friendStatusFriends: (username: string) =>
    `friend-status-friends-${username}`,
  /** Live-space badge on a friend who hosts an open space (host account id). */
  friendLiveSpace: (hostAccountId: string) =>
    `friend-live-space-${hostAccountId}`,
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
  /** "View profile" in the friend-request modal (fromUsername). */
  notificationsFriendRequestViewProfile: (fromUsername: string) =>
    `notifications-friend-request-view-profile-${fromUsername}`,
  /** "@x accepted your friend request" card (the accepter's username). */
  notificationsFriendAcceptedCard: (username: string) =>
    `notifications-friend-accepted-card-${username}`,

  // chess / spaces games
  gameMenuChess: 'game-menu-chess',
  chessMenuPuzzle: 'chess-menu-puzzle',
  chessMenuStats: 'chess-menu-stats',
  chessPuzzlePlayScreen: 'chess-puzzle-play-screen',
  chessPuzzleBoardFrame: 'chess-puzzle-board-frame',
  chessPuzzleBoard: 'chess-puzzle-board',
  chessPuzzleBoardElo: 'chess-puzzle-board-elo',
  chessPuzzleExpectedUci: 'chess-puzzle-expected-uci',
  chessPuzzleTestDebug: 'chess-puzzle-test-debug',
  /** Hidden probe: current display FEN (drivers derive legal wrong moves). */
  /** Hidden probe: `spectating=0|1 role=… kind=… clock=… recs=…`. */
  chessPuzzleTestSpectator: 'chess-puzzle-test-spectator',
  chessPuzzleTestFen: 'chess-puzzle-test-fen',
  /** Hidden probe: board orientation (`white` / `black`) = solver colour. */
  chessPuzzleBoardOrientation: 'chess-puzzle-board-orientation',
  /** Hidden probe: `active=<id>`, `pick=<nextId>`, `loading=0|1` pick status. */
  chessPuzzlePickStatus: 'chess-puzzle-pick-status',
  chessPuzzleSummary: 'chess-puzzle-summary',
  chessPuzzleSummaryClose: 'chess-puzzle-summary-close',
  /** The result panel's rating change ("+12", "-8") or "Unrated". */
  chessPuzzleSummaryDelta: 'chess-puzzle-summary-delta',
  /** The result panel's "Puzzle rating 1458": the puzzle's own rating. */
  chessPuzzleSummaryPuzzleRating: 'chess-puzzle-summary-puzzle-rating',
  /** Board-well block shown when the feed has no puzzle to place. */
  chessPuzzleEmptyPool: 'chess-puzzle-empty-pool',
  /** Secondary "Adjust feed" button under the exhausted-pool block. */
  chessPuzzleEmptyPoolAdjust: 'chess-puzzle-empty-pool-adjust',
  /** The empty feed's reason: "Failed" chosen with no failed attempts. */
  chessPuzzleEmptyPoolNoFailed: 'chess-puzzle-empty-pool-no-failed',
  chessPuzzleFeedSummary: 'chess-puzzle-feed-summary',
  /** Feed bar: "Auto · 1200" / "Custom · 1500" target label. */
  chessPuzzleFeedTargetLabel: 'chess-puzzle-feed-target-label',
  /** Feed bar: history filter label (Any / Unseen / Seen / Failed). */
  chessPuzzleFeedHistoryLabel: 'chess-puzzle-feed-history-label',
  chessPuzzleFeedThemesLabel: 'chess-puzzle-feed-themes-label',
  chessPuzzleFeedThemeTrigger: 'chess-puzzle-feed-theme-trigger',
  chessPuzzleFeedThemeSearch: 'chess-puzzle-feed-theme-search',
  chessPuzzleFeedThemeDone: 'chess-puzzle-feed-theme-done',
  chessPuzzleFeedThemeOption: (theme: string) =>
    `chess-puzzle-feed-theme-${theme}`,
  /** Feed settings modal parts. Segment ids are `<group>-<key>`. */
  chessPuzzleFeedModeSegment: (mode: 'auto' | 'custom') =>
    `chess-puzzle-feed-mode-${mode}`,
  chessPuzzleFeedHistorySegment: (
    filter: 'any' | 'neverSeen' | 'seen' | 'failed'
  ) => `chess-puzzle-feed-history-${filter}`,
  chessPuzzleFeedAutoAdvanceSegment: (
    setting: 'off' | 'after1s' | 'immediate'
  ) => `chess-puzzle-feed-auto-advance-${setting}`,
  chessPuzzleFeedOffsetIncrease: 'chess-puzzle-feed-offset-increase',
  chessPuzzleFeedOffsetDecrease: 'chess-puzzle-feed-offset-decrease',
  chessPuzzleFeedOffsetValue: 'chess-puzzle-feed-offset-value',
  chessPuzzleFeedCustomRatingIncrease:
    'chess-puzzle-feed-custom-rating-increase',
  chessPuzzleFeedCustomRatingDecrease:
    'chess-puzzle-feed-custom-rating-decrease',
  chessPuzzleFeedCustomRatingValue: 'chess-puzzle-feed-custom-rating-value',
  chessPuzzleFeedTarget: 'chess-puzzle-feed-target',
  chessPuzzleFeedPool: 'chess-puzzle-feed-pool',
  chessPuzzleFeedDone: 'chess-puzzle-feed-done',
  /** The feed settings' sign-in invitation, shown to a guest instead. */
  chessPuzzleFeedLocked: 'chess-puzzle-feed-locked',
  chessPuzzleActionSolution: 'chess-puzzle-action-solution',
  chessGameLogEmpty: 'chess-game-log-empty',
  /** Game-log row title ("Solved · 1275" / "Abandoned · 1275"). */
  chessGameLogRowTitle: (puzzleId: string) =>
    `chess-game-log-row-${puzzleId}-title`,
  /** A game log row's rating change ("+12", "-8") or "Unrated". */
  chessGameLogRowChange: (puzzleId: string) =>
    `chess-game-log-row-${puzzleId}-change`,
  chessPuzzleMoveHistory: 'chess-puzzle-move-history',
  chessPuzzleActionHint: 'chess-puzzle-action-hint',
  chessPuzzleActionNext: 'chess-puzzle-action-next',
  chessPuzzleActionRetry: 'chess-puzzle-action-retry',
  chessPuzzleActionBack: 'chess-puzzle-action-back',
  chessPuzzleActionForward: 'chess-puzzle-action-forward',
  chessPuzzleActionSkip: 'chess-puzzle-action-skip',
  chessPuzzleClock: 'chess-puzzle-clock',
  chessPuzzleStatusLabel: 'chess-puzzle-status-label',
  chessPuzzleSummaryNext: 'chess-puzzle-summary-next',
  chessPuzzleRecommendationLegend: 'chess-puzzle-recommendation-legend',
  chessPuzzleRecommendationClear: 'chess-puzzle-recommendation-clear',
  chessPuzzleWaitingForHost: 'chess-puzzle-waiting-for-host',
  chessStatsElo: 'chess-stats-elo',
  /** §15 P0 tiles: total solved and overall accuracy. */
  chessStatsSolved: 'chess-stats-solved',
  chessStatsAccuracy: 'chess-stats-accuracy',
  chessStatsPlayed: 'chess-stats-played',
  /** The i-th rating after a puzzle in the stats' rating history, oldest first. */
  chessStatsRatingHistoryPoint: (index: number) =>
    `chess-stats-rating-history-${index}`,
  chessPuzzleReviewBoard: 'chess-puzzle-review-board',
  /** Hidden review probe: `solveIdx|lastSolveIdx|animated|notation`. */
  chessPuzzleReviewTest: 'chess-puzzle-review-test',
  chessPuzzleReviewTestFen: 'chess-puzzle-review-test-fen',
  /** §7 move-list scrub controls (`start` / `back` / `forward` / `end`). */
  chessPuzzleMoveNav: (intent: 'start' | 'back' | 'forward' | 'end') =>
    `chess-puzzle-move-nav-${intent}`,
  /** §7 tappable move-list ply, by 0-based ply index. */
  chessPuzzleMovePly: (plyIndex: number) => `chess-puzzle-move-ply-${plyIndex}`,
  /** Hidden marker on the highlighted ply: `<plyIndex>|<san>`. */
  chessPuzzleMovePlySelected: 'chess-puzzle-move-ply-selected',
  /** Career game-log row scoped by puzzle id. */
  chessGameLogRow: (puzzleId: string) => `chess-game-log-row-${puzzleId}`,
  chessPuzzleLimit: 'chess-puzzle-limit',
  /** The board well's "You're offline" notice (no puzzles on the device). */
  chessPuzzleOffline: 'chess-puzzle-offline',
  /** The feed bar's "Unrated" label on a repeat of an already-rated puzzle. */
  chessPuzzleFeedUnratedLabel: 'chess-puzzle-feed-unrated-label',
  /** The feed bar's rating change for the puzzle on the board ("+12"). */
  chessPuzzleFeedRatingChange: 'chess-puzzle-feed-rating-change',
  /** The feed bar's themes of the puzzle on the board, once it is over. */
  chessPuzzleFeedPuzzleThemes: 'chess-puzzle-feed-puzzle-themes',
  /** The puzzle's live region: what someone listening to the app hears. */
  chessPuzzleAnnouncement: 'chess-puzzle-announcement',
  /** "Share puzzle link" on the puzzle screen. */
  chessPuzzleShareLink: 'chess-puzzle-share-link',
  /** A puzzle link's screen while it opens, or why it cannot. */
  chessPuzzleLinkScreen: 'chess-puzzle-link-screen',
  /** A puzzle link to a retired puzzle: it is no longer available. */
  chessPuzzleLinkUnavailable: 'chess-puzzle-link-unavailable',
} as const;

export type Handle = {
  [K in keyof typeof Handles]: (typeof Handles)[K] extends string
    ? (typeof Handles)[K]
    : never;
}[keyof typeof Handles];
