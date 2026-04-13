import { Box } from '@gamezilla/shared/ui';
import { useMemo, type ReactNode } from 'react';
import { SvgXml } from 'react-native-svg';

import { profileAvatarSvg } from './profile-dicebear';

export type ProfileDiceBearAvatarProps = {
  seed: string;
  size: number;
};

/**
 * Rounds a DiceBear SVG for use in headers and profile chrome.
 */
export function ProfileDiceBearAvatar({
  seed,
  size,
}: ProfileDiceBearAvatarProps): ReactNode {
  const xml = useMemo(() => profileAvatarSvg(seed, size), [seed, size]);

  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
      }}
    >
      <SvgXml xml={xml} width={size} height={size} />
    </Box>
  );
}
