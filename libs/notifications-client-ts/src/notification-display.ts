import {
  displayUsername,
  usernameLabel,
} from '@libs/moderation-shared-ts/display';
import type { AppModeration } from '@libs/moderation-shared-ts/policy';
import type { Notification } from '@libs/notifications-shared-ts/notification';

type UsernameSnapshot = {
  readonly raw: string;
  readonly label: string;
};

const USERNAME_KEY_SUFFIX = 'Username';
const HANDLE_CHAR = /[\p{L}\p{N}_.-]/u;

/**
 * Snapshot usernames a payload carries as `<role>Username` next to
 * `<role>UserId` (e.g. `fromUsername` / `fromUserId`), with how each may be
 * shown now. Only names the policy masks are returned.
 */
function maskedUsernames(
  moderation: AppModeration,
  payload: Notification['payload']
): readonly UsernameSnapshot[] {
  const out: UsernameSnapshot[] = [];
  for (const [key, raw] of Object.entries(payload)) {
    if (!key.endsWith(USERNAME_KEY_SUFFIX)) continue;
    if (typeof raw !== 'string' || raw.length === 0) continue;
    const role = key.slice(0, -USERNAME_KEY_SUFFIX.length);
    const userId = payload[`${role}UserId`];
    if (typeof userId !== 'string' || userId.length === 0) continue;
    if (!displayUsername(moderation, raw, userId).masked) continue;
    out.push({ raw, label: usernameLabel(moderation, raw, userId) });
  }
  return out;
}

/** Replaces each whole `@raw` handle in `text` with `label`. */
function replaceHandle(text: string, snapshot: UsernameSnapshot): string {
  const handle = `@${snapshot.raw}`;
  let result = '';
  let from = 0;
  for (;;) {
    const at = text.indexOf(handle, from);
    if (at < 0) break;
    const next = text.charAt(at + handle.length);
    const whole = next.length === 0 || !HANDLE_CHAR.test(next);
    result += text.slice(from, at) + (whole ? snapshot.label : handle);
    from = at + handle.length;
  }
  return result + text.slice(from);
}

function moderateText(
  text: string,
  snapshots: readonly UsernameSnapshot[]
): string {
  return snapshots.reduce(replaceHandle, text);
}

/**
 * A notification as its reader may see it: snapshot `@username`s in its copy
 * (title, subtitle, body, avatar label) go through the moderation policy, so
 * a name masked after the notification was sent shows its alias. Stored
 * notifications are never rewritten; returns `interaction` when unchanged.
 */
export function displayNotification(
  moderation: AppModeration,
  interaction: Notification
): Notification {
  const snapshots = maskedUsernames(moderation, interaction.payload);
  if (snapshots.length === 0) return interaction;
  return {
    ...interaction,
    title: moderateText(interaction.title, snapshots),
    ...(interaction.subtitle !== undefined
      ? { subtitle: moderateText(interaction.subtitle, snapshots) }
      : {}),
    ...(interaction.body !== undefined
      ? { body: moderateText(interaction.body, snapshots) }
      : {}),
    ...(interaction.avatar !== undefined
      ? {
          avatar: {
            ...interaction.avatar,
            fallbackLabel: moderateText(
              interaction.avatar.fallbackLabel,
              snapshots
            ),
          },
        }
      : {}),
  };
}
