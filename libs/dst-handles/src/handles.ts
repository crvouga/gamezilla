/**
 * Semantic DST / E2E handles shared by product UI (`testID={Handles.*}`) and
 * `@test/ui` drivers (`UiPort` / `by.testId`). Add a handle here when a control
 * must be uniquely addressable without copy or index hacks.
 */
export const Handles = {
  // status / chrome
  statusCurrentUser: 'status-current-user',
  navBack: 'nav-back',
  tabProfile: 'tab-profile',

  // account
  accountSignIn: 'account-sign-in',
  accountSignOut: 'account-sign-out',

  // sign-in modal
  authMethodEmail: 'auth-method-email',
  authGoToSignUp: 'auth-go-to-sign-up',
  authEmailInput: 'auth-email-input',
  authPasswordInput: 'auth-password-input',
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
} as const;

export type Handle = (typeof Handles)[keyof typeof Handles];
