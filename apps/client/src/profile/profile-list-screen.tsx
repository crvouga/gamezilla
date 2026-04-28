import { useAuth } from '@gamezilla/client/auth/auth-context';
import { PrincipalServiceToken } from '@gamezilla/client/auth/principal-service';
import { ProfileDiceBearAvatar } from '@gamezilla/client/profile/profile-dicebear-avatar';
import {
  createProfile,
  deleteProfile,
  switchProfile,
  type ProfileActionContext,
} from '@gamezilla/client/profile/profile-actions';
import {
  useProfiles,
  type ProfileListItem,
} from '@gamezilla/client/profile/use-profile-list';
import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import {
  Badge,
  Box,
  Button,
  Card,
  ConfirmationModal,
  Pressable,
  ScreenBase,
  Text,
} from '@gamezilla/lib/ui';
import { useDependency } from '@gamezilla/lib/dependency-injection/react';
import { usePatchesDb } from '@gamezilla/patch-db/react';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

type DeleteTarget = {
  profileId: string;
  label: string;
} | null;

function profileLabel(p: ProfileListItem): string {
  return p.displayName !== null && p.displayName.length > 0
    ? p.displayName
    : 'Unnamed profile';
}

function creatorCaption(
  p: ProfileListItem,
  principalId: string
): string {
  if (p.createdByPrincipalId === null) {
    return 'Created by: not recorded (older profile)';
  }
  if (p.createdByPrincipalId === principalId) {
    return 'Created by: this device';
  }
  return `Created by: principal ${p.createdByPrincipalId.slice(0, 8)}…`;
}

type ProfileRowProps = {
  profile: ProfileListItem;
  principalId: string;
  isBusy: boolean;
  onSwitch: (id: string) => void;
  onDelete: (target: DeleteTarget) => void;
};

function ProfileRow({
  profile: p,
  principalId,
  isBusy,
  onSwitch,
  onDelete,
}: ProfileRowProps) {
  const label = profileLabel(p);
  return (
    <Card key={p.profileId} elevation={1} sx={{ p: 3, gap: 2 }}>
      <Pressable
        onPress={() => onSwitch(p.profileId)}
        disabled={isBusy || p.isCurrent}
      >
        <Box
          sx={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
          }}
        >
          <ProfileDiceBearAvatar
            config={p.avatarConfig}
            fallbackSeed={p.profileId}
            size={48}
            loading={isBusy}
          />
          <Box sx={{ flex: 1, minWidth: 0, gap: 1 }}>
            <Box
              sx={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Text variant="bodyBold" numberOfLines={1} label={label} />
              {p.isCurrent ? (
                <Badge label="Current" color="info" size="sm" />
              ) : null}
            </Box>
            <Text
              variant="caption"
              sx={{ color: 'textSecondary' }}
              label={creatorCaption(p, principalId)}
            />
            {!p.isCurrent ? (
              <Text
                variant="caption"
                sx={{ color: 'textSecondary' }}
                label="Tap to use this profile"
              />
            ) : null}
          </Box>
        </Box>
      </Pressable>
      <Box sx={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Button
          title="Delete"
          variant="outlined"
          color="destructive"
          disabled={isBusy}
          onPress={() => onDelete({ profileId: p.profileId, label })}
        />
      </Box>
    </Card>
  );
}

function useProfileListActions(args: {
  ctx: ProfileActionContext;
  setBusyId: (v: string | null) => void;
  setCreating: (v: boolean) => void;
  setDeleteTarget: (v: DeleteTarget) => void;
  deleteTarget: DeleteTarget;
}) {
  const { ctx, setBusyId, setCreating, setDeleteTarget, deleteTarget } = args;
  const router = useRouter();
  const db = usePatchesDb();

  const onSwitch = useCallback(
    async (profileId: string) => {
      setBusyId(profileId);
      try {
        await switchProfile(db, profileId, ctx);
      } finally {
        setBusyId(null);
      }
    },
    [db, ctx, setBusyId]
  );

  const onCreate = useCallback(async () => {
    setCreating(true);
    try {
      await createProfile(db, ctx, { setAsCurrent: true });
      router.push('/profile/edit');
    } finally {
      setCreating(false);
    }
  }, [db, ctx, router, setCreating]);

  const confirmDelete = useCallback(async () => {
    if (deleteTarget === null) return;
    const id = deleteTarget.profileId;
    setDeleteTarget(null);
    setBusyId(id);
    try {
      await deleteProfile(db, id, ctx);
    } finally {
      setBusyId(null);
    }
  }, [db, ctx, deleteTarget, setBusyId, setDeleteTarget]);

  return { onSwitch, onCreate, confirmDelete };
}

type ProfileRowsProps = {
  loading: boolean;
  profiles: ProfileListItem[];
  principalId: string;
  busyId: string | null;
  onSwitch: (id: string) => void;
  onDelete: (target: DeleteTarget) => void;
};

function ProfileRows({
  loading,
  profiles,
  principalId,
  busyId,
  onSwitch,
  onDelete,
}: ProfileRowsProps) {
  if (loading) {
    return <Text variant="caption" label="Loading profiles…" />;
  }
  if (profiles.length === 0) {
    return (
      <Text
        variant="body"
        label="No profiles yet. Create one to customize your name and avatar."
      />
    );
  }
  return (
    <>
      {profiles.map((p) => (
        <ProfileRow
          key={p.profileId}
          profile={p}
          principalId={principalId}
          isBusy={busyId === p.profileId}
          onSwitch={(id) => void onSwitch(id)}
          onDelete={onDelete}
        />
      ))}
    </>
  );
}

export function ProfileListScreen() {
  const nav = useBreadcrumbNav();
  const auth = useAuth();
  const principalService = useDependency(PrincipalServiceToken);
  const principalId = principalService.getPrincipalId();
  const { profiles, loading } = useProfiles();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const ctx = useMemo<ProfileActionContext>(
    () => ({ principalId, accountId: auth.accountId }),
    [principalId, auth.accountId]
  );

  const { onSwitch, onCreate, confirmDelete } = useProfileListActions({
    ctx,
    setBusyId,
    setCreating,
    setDeleteTarget,
    deleteTarget,
  });

  return (
    <>
      <ConfirmationModal
        visible={deleteTarget !== null}
        title="Delete profile?"
        message={
          deleteTarget !== null
            ? `Remove “${deleteTarget.label}”? You can create another profile later.`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
      <ScreenBase
        breadcrumbs={[
          { name: 'Profile', onPress: nav('/profile') },
          { name: 'Profiles', subtitle: 'Switch, create, or remove' },
        ]}
        scroll
        content={({ sx }) => (
          <Box style={sx}>
            <Box sx={{ gap: 3 }}>
              <ProfileRows
                loading={loading}
                profiles={profiles}
                principalId={principalId}
                busyId={busyId}
                onSwitch={onSwitch}
                onDelete={setDeleteTarget}
              />
            </Box>
            <Box sx={{ mt: 4 }}>
              <Button
                title="Create new profile"
                onPress={() => void onCreate()}
                loading={creating}
                disabled={creating}
              />
            </Box>
          </Box>
        )}
      />
    </>
  );
}
