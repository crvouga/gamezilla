import { useLingui } from '@lingui/react/macro';
import { Pressable, useRouter } from '@pkgs/ui-rn';
import type { ReactNode } from 'react';
import { openSpaceDetail } from '../../../public/space-routes';

export type MiniplayerOpenSpacePressableProps = {
  spaceId: string;
  children: ReactNode;
  /** Optional hook after navigation is triggered (e.g. close a sheet). */
  onAfterOpen?: () => void;
};

/** Pressable that returns to a space — owns the route mapping. */
export function MiniplayerOpenSpacePressable({
  spaceId,
  children,
  onAfterOpen,
}: MiniplayerOpenSpacePressableProps): ReactNode {
  const router = useRouter();
  const { t } = useLingui();
  return (
    <Pressable
      onPress={() => {
        openSpaceDetail(router, spaceId);
        onAfterOpen?.();
      }}
      accessibilityRole="button"
      accessibilityLabel={t`Tap to return to your space`}
      sx={{
        flex: 1,
        alignSelf: 'stretch',
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
