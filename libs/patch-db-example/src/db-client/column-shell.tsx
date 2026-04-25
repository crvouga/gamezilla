import {
  Box,
  Pressable,
  ScrollView,
  Text,
  useTheme,
} from '@gamezilla/lib/ui';
import type { ReactNode } from 'react';
import { ScrollView as RNScrollView } from 'react-native';

export type BreadcrumbItem = {
  key: string;
  label: string;
  onPress: () => void;
};

export type ColumnPanel = {
  key: string;
  title: string;
  children: ReactNode;
};

export type ColumnShellProps = {
  /** Visible column panels (already sliced to the right-most N). */
  panels: ColumnPanel[];
  /** When true, show breadcrumb row above columns (single-column / narrow mode). */
  showBreadcrumbs: boolean;
  breadcrumbs: BreadcrumbItem[];
};

const MIN_COL_WIDTH = 260;

function BreadcrumbRow({ breadcrumbs }: { breadcrumbs: BreadcrumbItem[] }) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        px: 3,
        py: 2,
        borderBottomWidth: 1,
        borderColor: 'border',
        background: 'surface',
      }}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
          {breadcrumbs.map((b, i) => (
            <Box
              key={b.key}
              sx={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}
            >
              {i > 0 ? (
                <Text
                  variant="caption"
                  style={{ color: theme.colors.textSecondary }}
                  label="/"
                />
              ) : null}
              <Pressable onPress={b.onPress} hitSlop={4}>
                <Text
                  variant="caption"
                  style={{ color: theme.colors.tint, maxWidth: 200 }}
                  numberOfLines={1}
                  ellipsizeMode="middle"
                  label={b.label}
                />
              </Pressable>
            </Box>
          ))}
        </Box>
      </ScrollView>
    </Box>
  );
}

function ColumnPanelView({
  panel,
  isLast,
}: {
  panel: ColumnPanel;
  isLast: boolean;
}) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: MIN_COL_WIDTH,
        borderRightWidth: isLast ? 0 : 1,
        borderColor: 'border',
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 2,
          borderBottomWidth: 1,
          borderColor: 'border',
          background: 'surface',
        }}
      >
        <Text
          variant="label"
          numberOfLines={1}
          ellipsizeMode="tail"
          label={panel.title}
        />
      </Box>
      <Box sx={{ flex: 1, minHeight: 0 }}>{panel.children}</Box>
    </Box>
  );
}

function ColumnList({ panels }: { panels: ColumnPanel[] }) {
  return (
    <>
      {panels.map((panel, index) => (
        <ColumnPanelView
          key={panel.key}
          panel={panel}
          isLast={index === panels.length - 1}
        />
      ))}
    </>
  );
}

export function ColumnShell({
  panels,
  showBreadcrumbs,
  breadcrumbs,
}: ColumnShellProps) {
  return (
    <Box sx={{ flex: 1 }}>
      {showBreadcrumbs && breadcrumbs.length > 0 ? (
        <BreadcrumbRow breadcrumbs={breadcrumbs} />
      ) : null}
      {panels.length > 1 ? (
        <RNScrollView
          horizontal
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          showsHorizontalScrollIndicator
        >
          <Box sx={{ flex: 1, flexDirection: 'row', minHeight: 0 }}>
            <ColumnList panels={panels} />
          </Box>
        </RNScrollView>
      ) : (
        <Box sx={{ flex: 1, flexDirection: 'row' }}>
          <ColumnList panels={panels} />
        </Box>
      )}
    </Box>
  );
}
