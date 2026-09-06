import { AppLogo } from '../app-logo';
import { ExampleRoot } from '../explorer/example-root';
import { Gamepad2Icon, SearchIcon, UserIcon } from '../icons';
import { AppHeaderIsland } from './app-header-island';

export default function AppHeaderIslandExample() {
  return (
    <ExampleRoot>
      <AppHeaderIsland
        leading={<AppLogo size={24} />}
        items={[
          {
            id: 'spaces',
            label: 'Spaces',
            icon: Gamepad2Icon,
            active: true,
            onPress: () => {},
          },
          {
            id: 'search',
            label: 'Search',
            icon: SearchIcon,
            active: false,
            onPress: () => {},
          },
          {
            id: 'profile',
            label: 'Profile',
            icon: UserIcon,
            active: false,
            onPress: () => {},
          },
        ]}
      />
    </ExampleRoot>
  );
}
