import { Trans, useLingui } from '@lingui/react/macro';
import {
  Box,
  ChipGroup,
  EmptyState,
  Gamepad2Icon,
  LoadingState,
  PlusIcon,
  ScreenBase,
  ScrollView,
  type ChipGroupOption,
  type ScreenBasePrimaryAction,
} from '@pkgs/ui';
import { useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';

import { SpaceCard } from './card/space-card';
import { useCreateSpace } from './create-space/use-create-space';
import { LIVE_SPACE_SECTION } from './live-space-section';
import { openSpaceDetail } from './space-routes';
import { useCurrentSpaceCount } from './use-current-space-count';
import {
  useLiveSpaceIdsBySection,
  type LiveSpaceSection,
} from './use-live-space-ids-by-section';

function SpaceSectionList({
  section,
  emptyTitle,
}: {
  readonly section: LiveSpaceSection;
  readonly emptyTitle: ReactNode;
}) {
  const { spaceIds, isLoading } = useLiveSpaceIdsBySection(section);
  if (isLoading) {
    return <LoadingState size="large" />;
  }
  if (spaceIds.length === 0) {
    return <EmptyState icon={Gamepad2Icon} title={emptyTitle} />;
  }
  return (
    <Box sx={{ gap: 3 }}>
      {spaceIds.map((spaceId) => (
        <SpaceCard key={spaceId} spaceId={spaceId} />
      ))}
    </Box>
  );
}

function emptyTitleForSection(section: LiveSpaceSection): ReactNode {
  if (section === LIVE_SPACE_SECTION.public) {
    return <Trans>No public spaces</Trans>;
  }
  return <Trans>No live spaces</Trans>;
}

function SpacesList() {
  const { t } = useLingui();
  const [section, setSection] = useState<LiveSpaceSection>(
    LIVE_SPACE_SECTION.friends
  );

  const options = useMemo((): readonly ChipGroupOption<LiveSpaceSection>[] => {
    return [
      { key: LIVE_SPACE_SECTION.friends, label: t`Friends` },
      { key: LIVE_SPACE_SECTION.public, label: t`Public` },
    ];
  }, [t]);

  return (
    <Box sx={{ flex: 1, gap: 2 }}>
      <ChipGroup options={options} selected={section} onSelect={setSection} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: 24,
          gap: 8,
        }}
      >
        <SpaceSectionList
          section={section}
          emptyTitle={emptyTitleForSection(section)}
        />
      </ScrollView>
    </Box>
  );
}

export type SpacesScreenProps = {
  readonly accountMenu?: ReactNode;
  readonly leading?: ReactNode;
};

export function SpacesScreen({ accountMenu, leading }: SpacesScreenProps) {
  const { count: currentSpaceCount, isLoading: membershipLoading } =
    useCurrentSpaceCount();
  const canCreateSpace = !membershipLoading && currentSpaceCount === 0;
  const router = useRouter();
  const createSpace = useCreateSpace();
  const { t } = useLingui();

  const primaryAction = useMemo((): ScreenBasePrimaryAction => {
    return {
      labels: {
        idle: t`New space`,
        loading: t`Opening…`,
        success: t`Ready`,
        error: t`Couldn't open`,
      },
      operation: async () => {
        await createSpace((id) => {
          openSpaceDetail(router, id);
        });
      },
      successHoldMs: 0,
      icon: PlusIcon,
      disabled: !canCreateSpace,
    };
  }, [canCreateSpace, createSpace, router, t]);

  return (
    <ScreenBase
      breadcrumbs={[{ name: t`Spaces` }]}
      accountMenu={accountMenu}
      leading={leading}
      primaryAction={primaryAction}
      content={({ sx }) => (
        <Box style={sx}>
          <SpacesList />
        </Box>
      )}
    />
  );
}
