import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import type { JSX } from 'solid-js';
import { ProfileEditScreenView } from './profile-edit-screen-view';

/** `/profile/edit`: routes each `ProfileEditScreenView` row to its editor. */
export function ProfileEditScreen(): JSX.Element {
  const router = useRouter();
  return (
    <ProfileEditScreenView
      onOpenPrivacy={() => router.push('/profile/privacy')}
      onOpenUsername={() => router.push('/profile/handle')}
      onOpenAvatar={() => router.push('/profile/avatar')}
    />
  );
}
