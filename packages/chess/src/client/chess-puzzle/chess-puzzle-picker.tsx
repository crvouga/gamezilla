import {
  andWhereClause,
  type PatchDbQueryWhereClause,
} from '@gamezilla/patch-db/interface';
import {
  useQueryAttribute,
  useQueryEntityIds,
} from '@gamezilla/patch-db/react';
import {
  Box,
  Card,
  IconSymbol,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useTheme,
} from '@gamezilla/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  CHESS_PUZZLE_ENTITY_TYPE,
  ChessPuzzleAttr,
} from '../../shared/chess-puzzle-entities';

const PAGE_STEP = 50;
const LIST_MAX_WIDTH = 720;
const THEMES_PREVIEW_MAX = 4;

function buildPuzzleListWhere(args: {
  minRating: number;
  maxRating: number;
  themeQuery: string;
}): PatchDbQueryWhereClause | undefined {
  const { minRating, maxRating, themeQuery } = args;
  let w: PatchDbQueryWhereClause | undefined;
  if (minRating > 0) {
    w = andWhereClause(w, {
      type: 'gte',
      attribute: ChessPuzzleAttr.rating.key,
      value: minRating,
    });
  }
  if (maxRating > 0) {
    w = andWhereClause(w, {
      type: 'lte',
      attribute: ChessPuzzleAttr.rating.key,
      value: maxRating,
    });
  }
  const t = themeQuery.trim();
  if (t.length > 0) {
    w = andWhereClause(w, {
      type: 'contains',
      attribute: ChessPuzzleAttr.themes.key,
      value: t,
    });
  }
  return w;
}

type PuzzleRowFields = {
  id: string;
  rating: number;
  popularity: number;
  themes: readonly string[];
};

function usePuzzleRowFields(entityId: string): PuzzleRowFields {
  const id = useQueryAttribute({
    entityType: CHESS_PUZZLE_ENTITY_TYPE,
    entityId,
    attribute: ChessPuzzleAttr.id,
  });
  const rating = useQueryAttribute({
    entityType: CHESS_PUZZLE_ENTITY_TYPE,
    entityId,
    attribute: ChessPuzzleAttr.rating,
  });
  const popularity = useQueryAttribute({
    entityType: CHESS_PUZZLE_ENTITY_TYPE,
    entityId,
    attribute: ChessPuzzleAttr.popularity,
  });
  const themes = useQueryAttribute({
    entityType: CHESS_PUZZLE_ENTITY_TYPE,
    entityId,
    attribute: ChessPuzzleAttr.themes,
  });
  return { id, rating, popularity, themes };
}

function PuzzleRowSummary({
  label,
  rating,
  popularity,
  themes,
}: {
  label: string;
  rating: number;
  popularity: number;
  themes: readonly string[];
}): ReactNode {
  const themesPreview =
    themes.length > 0 ? themes.slice(0, THEMES_PREVIEW_MAX).join(', ') : null;
  return (
    <Box sx={{ flex: 1, gap: 1 }}>
      <Text variant="title" label={label} />
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={
          <Trans>
            Rating {rating} · popularity {popularity}
          </Trans>
        }
      />
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={themesPreview ?? <Trans>No themes listed</Trans>}
      />
    </Box>
  );
}

function PuzzlePickerRow({
  entityId,
  onPick,
}: {
  entityId: string;
  onPick: (puzzleId: string) => void;
}): ReactNode {
  const theme = useTheme();
  const { id, rating, popularity, themes } = usePuzzleRowFields(entityId);
  const label = id.length > 0 ? id : entityId;
  return (
    <Pressable onPress={() => onPick(entityId)}>
      <Card
        elevation={0}
        sx={{
          py: 3,
          px: 4,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 3,
        }}
      >
        <PuzzleRowSummary
          label={label}
          rating={rating}
          popularity={popularity}
          themes={themes}
        />
        <IconSymbol name="chevron.right" size={20} color={theme.colors.icon} />
      </Card>
    </Pressable>
  );
}

export type PuzzlePickerProps = {
  onPickPuzzle: (puzzleId: string) => void;
  notice?: ReactNode;
};

type PuzzleFilters = {
  themeQuery: string;
  setThemeQuery: (v: string) => void;
  minRatingRaw: string;
  setMinRatingRaw: (v: string) => void;
  maxRatingRaw: string;
  setMaxRatingRaw: (v: string) => void;
  minRating: number;
  maxRating: number;
  pageSize: number;
  loadMore: () => void;
};

function parsePositiveInt(raw: string): number {
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function usePuzzleFilters(): PuzzleFilters {
  const [themeQuery, setThemeQuery] = useState('');
  const [minRatingRaw, setMinRatingRaw] = useState('');
  const [maxRatingRaw, setMaxRatingRaw] = useState('');
  const [pageSize, setPageSize] = useState(PAGE_STEP);

  const minRating = useMemo(
    () => parsePositiveInt(minRatingRaw),
    [minRatingRaw]
  );
  const maxRating = useMemo(
    () => parsePositiveInt(maxRatingRaw),
    [maxRatingRaw]
  );

  useEffect(() => {
    setPageSize(PAGE_STEP);
  }, [themeQuery, minRating, maxRating]);

  const loadMore = useCallback(() => {
    setPageSize((n) => n + PAGE_STEP);
  }, []);

  return {
    themeQuery,
    setThemeQuery,
    minRatingRaw,
    setMinRatingRaw,
    maxRatingRaw,
    setMaxRatingRaw,
    minRating,
    maxRating,
    pageSize,
    loadMore,
  };
}

function PuzzlePickerIntro(): ReactNode {
  return (
    <>
      <Text
        variant="title"
        sx={{ textAlign: 'center' }}
        label={<Trans>Pick a puzzle</Trans>}
      />
      <Text
        variant="body"
        sx={{ color: 'textSecondary', textAlign: 'center', opacity: 0.85 }}
        label={
          <Trans>
            Search by theme keyword and optional rating bounds. Data loads from
            PatchDB.
          </Trans>
        }
      />
    </>
  );
}

function PuzzleRatingBoundsRow({
  minRatingRaw,
  setMinRatingRaw,
  maxRatingRaw,
  setMaxRatingRaw,
}: {
  minRatingRaw: string;
  setMinRatingRaw: (v: string) => void;
  maxRatingRaw: string;
  setMaxRatingRaw: (v: string) => void;
}): ReactNode {
  const { t } = useLingui();
  return (
    <Box sx={{ flexDirection: 'row', gap: 3 }}>
      <Box sx={{ flex: 1 }}>
        <TextInput
          label={<Trans>Min rating (optional)</Trans>}
          placeholder={t`e.g. 1500`}
          value={minRatingRaw}
          onChangeText={setMinRatingRaw}
          keyboardType="number-pad"
          accessibilityLabel={t`Minimum rating`}
        />
      </Box>
      <Box sx={{ flex: 1 }}>
        <TextInput
          label={<Trans>Max rating (optional)</Trans>}
          placeholder={t`e.g. 2000`}
          value={maxRatingRaw}
          onChangeText={setMaxRatingRaw}
          keyboardType="number-pad"
          accessibilityLabel={t`Maximum rating`}
        />
      </Box>
    </Box>
  );
}

function PuzzlePickerFilters({
  filters,
}: {
  filters: PuzzleFilters;
}): ReactNode {
  const { t } = useLingui();
  return (
    <>
      <TextInput
        label={<Trans>Theme contains</Trans>}
        placeholder={t`e.g. fork, mateIn2`}
        value={filters.themeQuery}
        onChangeText={filters.setThemeQuery}
        accessibilityLabel={t`Theme search`}
      />
      <PuzzleRatingBoundsRow
        minRatingRaw={filters.minRatingRaw}
        setMinRatingRaw={filters.setMinRatingRaw}
        maxRatingRaw={filters.maxRatingRaw}
        setMaxRatingRaw={filters.setMaxRatingRaw}
      />
    </>
  );
}

function LoadMoreButton({ onPress }: { onPress: () => void }): ReactNode {
  return (
    <Pressable onPress={onPress}>
      <Card elevation={0} sx={{ py: 3, alignItems: 'center' }}>
        <Text variant="body" label={<Trans>Load more</Trans>} />
      </Card>
    </Pressable>
  );
}

function PuzzlePickerResults({
  ids,
  onPickPuzzle,
  onLoadMore,
}: {
  ids: readonly string[];
  onPickPuzzle: (puzzleId: string) => void;
  onLoadMore: () => void;
}): ReactNode {
  const shownCount = ids.length;
  return (
    <>
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={<Trans>Showing first {shownCount} by popularity</Trans>}
      />
      <Box sx={{ gap: 2 }}>
        {ids.map((entityId) => (
          <PuzzlePickerRow
            key={entityId}
            entityId={entityId}
            onPick={onPickPuzzle}
          />
        ))}
      </Box>
      <LoadMoreButton onPress={onLoadMore} />
    </>
  );
}

function usePuzzleIds(filters: PuzzleFilters): readonly string[] {
  const where = useMemo(
    () =>
      buildPuzzleListWhere({
        minRating: filters.minRating,
        maxRating: filters.maxRating,
        themeQuery: filters.themeQuery,
      }),
    [filters.minRating, filters.maxRating, filters.themeQuery]
  );
  return useQueryEntityIds({
    entityType: CHESS_PUZZLE_ENTITY_TYPE,
    ...(where !== undefined ? { where } : {}),
    orderBy: [{ attribute: ChessPuzzleAttr.popularity.key, direction: 'desc' }],
    limit: filters.pageSize,
  });
}

export function PuzzlePicker({
  onPickPuzzle,
  notice,
}: PuzzlePickerProps): ReactNode {
  const filters = usePuzzleFilters();
  const ids = usePuzzleIds(filters);
  return (
    <ScrollView
      style={{ flex: 1, alignSelf: 'stretch' }}
      contentContainerStyle={{ paddingBottom: 24, alignItems: 'stretch' }}
    >
      <Box
        sx={{
          alignSelf: 'center',
          maxWidth: LIST_MAX_WIDTH,
          gap: 4,
          px: 4,
          pt: 2,
        }}
        style={{ width: '100%' }}
      >
        <PuzzlePickerIntro />
        {notice}
        <PuzzlePickerFilters filters={filters} />
        <PuzzlePickerResults
          ids={ids}
          onPickPuzzle={onPickPuzzle}
          onLoadMore={filters.loadMore}
        />
      </Box>
    </ScrollView>
  );
}
