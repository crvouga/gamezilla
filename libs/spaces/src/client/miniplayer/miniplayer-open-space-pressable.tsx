import { Pressable } from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { spaceDetailHref } from '../space-routes';

export type MiniplayerOpenSpacePressableProps = {
  spaceId: string;
  children: ReactNode;
};

/** Pressable that returns to a space — owns the route mapping. */
export function MiniplayerOpenSpacePressable({
  spaceId,
  children,
}: MiniplayerOpenSpacePressableProps): ReactNode {
  const router = useRouter();
  const { t } = useLingui();
  return (
    <Pressable
      onPress={() => router.push(spaceDetailHref(spaceId))}
      accessibilityRole="button"
      accessibilityLabel={t`Tap to return to your space`}
      sx={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        minWidth: 0,
      }}
    >
      {children}
    </Pressable>
  );
}
