import { Stack } from '../stack';
import { Text } from '../text';
import { UserIcon } from '../icons';
import { Avatar } from '../avatar';
import { AvatarGroup } from './avatar-group';
import { ExampleRoot } from '../explorer/example-root';

const SAMPLE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="32" fill="#6366f1" />
  <circle cx="32" cy="24" r="10" fill="#fff" />
</svg>
`.trim();

export default function AvatarGroupExample() {
  return (
    <ExampleRoot sx={{ gap: 6 }}>
      <Text variant="heading" label="AvatarGroup" />

      <Text variant="caption" label="Default overlap (40% of size), size 36" />
      <AvatarGroup size={36}>
        <Avatar initials="A" size={36} background="tint" />
        <Avatar initials="B" size={36} background="success" />
        <Avatar initials="C" size={36} background="warning" />
        <Avatar svg={SAMPLE_SVG} size={36} />
      </AvatarGroup>

      <Text variant="caption" label="maxVisible={3} shows +N overflow pill" />
      <AvatarGroup size={40} maxVisible={3}>
        <Avatar initials="JD" size={40} />
        <Avatar initials="AB" size={40} background="success" />
        <Avatar initials="XY" size={40} background="warning" />
        <Avatar initials="ZZ" size={40} background="destructive" />
        <Avatar uri="https://i.pravatar.cc/100?u=9" size={40} />
      </AvatarGroup>

      <Text variant="caption" label="Tighter overlap (10px), size 48" />
      <Stack direction="horizontal" spacing={4} align="center">
        <AvatarGroup size={48} overlap={10}>
          <Avatar icon={UserIcon} size={48} background="outline" />
          <Avatar initials="M" size={48} background="tint" />
          <Avatar initials="K" size={48} background="info" />
        </AvatarGroup>
      </Stack>

      <Text
        variant="caption"
        label="onPress wraps stack (accessibility button)"
      />
      <AvatarGroup size={32} maxVisible={4} onPress={() => {}}>
        <Avatar initials="1" size={32} />
        <Avatar initials="2" size={32} background="success" />
        <Avatar initials="3" size={32} background="warning" />
        <Avatar initials="4" size={32} background="destructive" />
        <Avatar initials="5" size={32} />
      </AvatarGroup>
    </ExampleRoot>
  );
}
