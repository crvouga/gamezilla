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
import {
  andWhereClause,
  type PatchDbQueryWhereClause,
} from '@gamezilla/patch-db/interface';
import {
  useQueryAttribute,
  useQueryEntityIds,
} from '@gamezilla/patch-db/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  CHESS_PUZZLE_ENTITY_TYPE,
  ChessPuzzleAttr,
} from '../shared/chess-puzzle-entities';

const PAGE_STEP = 50;
const LIST_MAX_WIDTH = 720;

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

function PuzzlePickerRow({
  entityId,
  onPick,
}: {
  entityId: string;
  onPick: (puzzleId: string) => void;
}): ReactNode {
  const theme = useTheme();
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
  const label = id.length > 0 ? id : entityId;
  const themesPreview =
    themes.length > 0 ? themes.slice(0, 4).join(', ') : null;
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
          {themesPreview !== null ? (
            <Text
              variant="caption"
              sx={{ color: 'textSecondary' }}
              label={themesPreview}
            />
          ) : (
            <Text
              variant="caption"
              sx={{ color: 'textSecondary' }}
              label={<Trans>No themes listed</Trans>}
            />
          )}
        </Box>
        <IconSymbol name="chevron.right" size={20} color={theme.colors.icon} />
      </Card>
    </Pressable>
  );
}

export type PuzzlePickerProps = {
  onPickPuzzle: (puzzleId: string) => void;
  notice?: ReactNode;
};

export function PuzzlePicker({
  onPickPuzzle,
  notice,
}: PuzzlePickerProps): ReactNode {
  const { t } = useLingui();
  const [themeQuery, setThemeQuery] = useState('');
  const [minRatingRaw, setMinRatingRaw] = useState('');
  const [maxRatingRaw, setMaxRatingRaw] = useState('');
  const [pageSize, setPageSize] = useState(PAGE_STEP);

  const minRating = useMemo(() => {
    const n = Number.parseInt(minRatingRaw.trim(), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [minRatingRaw]);

  const maxRating = useMemo(() => {
    const n = Number.parseInt(maxRatingRaw.trim(), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [maxRatingRaw]);

  useEffect(() => {
    setPageSize(PAGE_STEP);
  }, [themeQuery, minRating, maxRating]);

  const where = useMemo(
    () =>
      buildPuzzleListWhere({
        minRating,
        maxRating,
        themeQuery,
      }),
    [minRating, maxRating, themeQuery]
  );

  const ids = useQueryEntityIds({
    entityType: CHESS_PUZZLE_ENTITY_TYPE,
    ...(where !== undefined ? { where } : {}),
    orderBy: [{ attribute: ChessPuzzleAttr.popularity.key, direction: 'desc' }],
    limit: pageSize,
  });

  const shownCount = ids.length;

  return (
    <ScrollView
      style={{ flex: 1, alignSelf: 'stretch' }}
      contentContainerStyle={{
        paddingBottom: 24,
        alignItems: 'stretch',
      }}
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
              Search by theme keyword and optional rating bounds. Data loads
              from PatchDB.
            </Trans>
          }
        />

        {notice}

        <TextInput
          label={<Trans>Theme contains</Trans>}
          placeholder={t`e.g. fork, mateIn2`}
          value={themeQuery}
          onChangeText={setThemeQuery}
          accessibilityLabel={t`Theme search`}
        />
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

        <Pressable
          onPress={() => {
            setPageSize((n) => n + PAGE_STEP);
          }}
        >
          <Card
            elevation={0}
            sx={{
              py: 3,
              alignItems: 'center',
            }}
          >
            <Text variant="body" label={<Trans>Load more</Trans>} />
          </Card>
        </Pressable>
      </Box>
    </ScrollView>
  );
}
