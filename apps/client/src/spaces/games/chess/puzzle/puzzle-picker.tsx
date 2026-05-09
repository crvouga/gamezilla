import {
  CHESS_SCREEN,
  SetChessMainMenuScreen,
} from '@gamezilla/domain/spaces/games/chess/chess-main-menu';
import {
  CHESS_PUZZLE_ENTITY_TYPE,
  ChessPuzzleAttr,
} from '@gamezilla/domain/spaces/games/chess/puzzle/chess-puzzle-entities';
import { SelectChessPuzzle } from '@gamezilla/domain/spaces/games/chess/puzzle/chess-puzzle-session';
import {
  Box,
  Card,
  IconButton,
  IconSymbol,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useTheme,
} from '@gamezilla/lib/ui';
import {
  andWhereClause,
  type PatchDbQueryWhereClause,
} from '@gamezilla/patch-db/interface';
import {
  useQueryAttribute,
  useQueryEntityIds,
} from '@gamezilla/patch-db/react';
import { RoomMetaAttr } from '@gamezilla/room';
import { Trans, useLingui } from '@lingui/react/macro';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  useSpaceDispatch,
  useSpaceSelector,
} from '../../../room/use-space-room-selector';

const PAGE_STEP = 50;
const LIST_MAX_WIDTH = 720;
const BACK_BUTTON_SIZE = 40;
const BACK_ROW_PADDING_TOP = 12;
const BACK_ROW_PADDING_HORIZONTAL = 12;

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

function BackButtonRow({ onPress }: { onPress: () => void }): ReactNode {
  const { t } = useLingui();
  const theme = useTheme();
  return (
    <Box
      style={{
        alignSelf: 'stretch',
        alignItems: 'flex-start',
        height: BACK_BUTTON_SIZE + BACK_ROW_PADDING_TOP,
        paddingHorizontal: BACK_ROW_PADDING_HORIZONTAL,
        paddingTop: BACK_ROW_PADDING_TOP,
      }}
    >
      <IconButton
        size={BACK_BUTTON_SIZE}
        background="surface"
        onPress={onPress}
        accessibilityLabel={t`Back`}
      >
        <IconSymbol
          name="chevron.right"
          size={20}
          color={theme.colors.text}
          style={{ transform: [{ scaleX: -1 }] }}
        />
      </IconButton>
    </Box>
  );
}

export function PuzzlePicker(): ReactNode {
  const dispatch = useSpaceDispatch();
  const isSynced = useSpaceSelector(RoomMetaAttr.isSynced.from);
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

  const backToPuzzleMenu = useCallback(() => {
    dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.puzzle }));
  }, [dispatch]);

  const onPick = useCallback(
    (puzzleId: string) => {
      dispatch(SelectChessPuzzle({ puzzleId }));
      dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.puzzlePlay }));
    },
    [dispatch]
  );

  const shownCount = ids.length;

  return (
    <Box sx={{ alignSelf: 'stretch', flex: 1 }}>
      <BackButtonRow onPress={backToPuzzleMenu} />

      <ScrollView
        style={{ flex: 1 }}
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

          {!isSynced ? (
            <Text
              variant="caption"
              sx={{ color: 'textSecondary', textAlign: 'center' }}
              label={<Trans>Waiting for space sync…</Trans>}
            />
          ) : null}

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
                onPick={onPick}
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
    </Box>
  );
}
