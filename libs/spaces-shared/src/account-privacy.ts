import type { AccountPrivacyContribution } from '@libs/feature-shared/account-privacy';
import sql from '@pkgs/sql-root-shared/sql';
import { changeSpaceRoomMembership } from './space-withdrawal';

export const SPACES_PRIVACY: AccountPrivacyContribution = {
  name: 'spaces',
  snapshot: async ({ tx, env }) => ({
    hosted: await tx.query(
      sql<
        Record<string, unknown>
      >`SELECT id, title, created_at, ended_at, visibility FROM spaces WHERE host_id = ${env.actorId} OR host_account_id = ${env.actorId} OR host_member_id = ${env.actorId}`
    ),
    joined: await tx.query(
      sql<
        Record<string, unknown>
      >`SELECT space_id, created_at FROM spaces_users WHERE user_id = ${env.actorId}`
    ),
  }),
  withdraw: async ({ tx, env }) => {
    const places = await tx.query(
      sql<{
        id: string;
        host_id: string | null;
        host_account_id: string | null;
        host_member_id: string | null;
      }>`SELECT DISTINCT s.id, s.host_id, s.host_account_id, s.host_member_id FROM spaces s LEFT JOIN spaces_users u ON u.space_id = s.id WHERE s.host_id = ${env.actorId} OR s.host_account_id = ${env.actorId} OR s.host_member_id = ${env.actorId} OR u.user_id = ${env.actorId}`
    );
    for (const place of places)
      await changeSpaceRoomMembership(
        { tx, env },
        place.id,
        [place.host_id, place.host_account_id, place.host_member_id].includes(
          env.actorId
        )
          ? 'ended'
          : 'left'
      );
    const now = (env.serverNow ?? env.now)().toISOString();
    await tx.run(
      sql`UPDATE spaces SET ended_at = ${now} WHERE (host_id = ${env.actorId} OR host_account_id = ${env.actorId} OR host_member_id = ${env.actorId}) AND ended_at IS NULL`
    );
    await tx.run(
      sql`UPDATE spaces_users SET deleted_at = ${now} WHERE user_id = ${env.actorId}`
    );
    await tx.run(
      sql`UPDATE spaces_open_sessions SET deleted_at = ${now} WHERE device_id IN (SELECT device_id FROM auth_account_devices WHERE user_id = ${env.actorId})`
    );
  },
  erase: async ({ tx, env }, rooms) => {
    const places = await tx.query(
      sql<{
        id: string;
      }>`SELECT DISTINCT s.id FROM spaces s LEFT JOIN spaces_users u ON u.space_id = s.id WHERE s.host_id = ${env.actorId} OR s.host_account_id = ${env.actorId} OR s.host_member_id = ${env.actorId} OR u.user_id = ${env.actorId}`
    );
    for (const place of places)
      await rooms.eraseIdentity(
        `space:${place.id}`,
        env.actorId,
        `former-person:${env.createId()}`
      );
    await tx.run(
      sql`UPDATE spaces SET host_id = ${null}, host_account_id = ${null}, host_member_id = ${null}, title = ${'Ended space'} WHERE host_id = ${env.actorId} OR host_account_id = ${env.actorId} OR host_member_id = ${env.actorId}`
    );
    await tx.run(
      sql`UPDATE spaces_users SET user_id = ${null}, created_by_account_id = ${null} WHERE user_id = ${env.actorId}`
    );
  },
};
