import {
  Box,
  Button,
  Card,
  Divider,
  SegmentedControl,
  Stack,
  Switch,
  Text,
} from '@pkgs/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { useMemo, useState, type ReactNode } from 'react';
import { ChessBoard } from './chess-board';
import type {
  BoardArrow,
  BoardOrientation,
  BoardTheme,
  CellFeedback,
  CellFeedbackKind,
  CellHighlight,
  Move,
  Square,
} from './chess-board-types';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const SMITH_MORRA_FEN =
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';

/** Single white pawn one move from queening; player can immediately promote. */
const PRE_PROMOTION_FEN = '4k3/P7/8/8/8/8/8/4K3 w - - 0 1';

const PUZZLE_COMBINATION_FEN =
  'r3k2r/1ppq1pp1/p1n1bn1p/3pp3/3PP3/2NB1N2/PPPQ1PPP/R3K2R w KQkq - 0 1';

const ALL_FEEDBACK_KINDS: readonly CellFeedbackKind[] = [
  'check',
  'cross',
  'exclamation',
  'doubleExclam',
  'question',
  'questionExclam',
  'star',
  'crown',
  'dot',
];

function ExampleSection(props: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}): ReactNode {
  return (
    <Box sx={{ gap: 3, paddingBottom: 4 }}>
      <Text variant="heading" label={props.title} />
      {props.description !== undefined ? (
        <Text
          variant="caption"
          sx={{ color: 'textSecondary' }}
          label={props.description}
        />
      ) : null}
      <Box>{props.children}</Box>
    </Box>
  );
}

function BasicsSection(): ReactNode {
  const [orientation, setOrientation] = useState<BoardOrientation>('white');
  const { t } = useLingui();
  return (
    <ExampleSection
      title={<Trans>Basics</Trans>}
      description={
        <Trans>Default board, drag or tap-to-move, orientation toggle.</Trans>
      }
    >
      <Stack spacing={3}>
        <SegmentedControl
          segments={[
            { key: 'white', label: t`White` },
            { key: 'black', label: t`Black` },
          ]}
          selected={orientation}
          onSelect={(k) => setOrientation(k as BoardOrientation)}
        />
        <ChessBoard
          orientation={orientation}
          showCoordinates
          highlightLastMove
          highlightLegalMoves
        />
      </Stack>
    </ExampleSection>
  );
}

function FeedbackSection(): ReactNode {
  const cellFeedback = useMemo<Partial<Record<Square, CellFeedback>>>(() => {
    const squares: Square[] = [
      'a3',
      'b3',
      'c3',
      'd3',
      'e3',
      'f3',
      'g3',
      'h3',
      'd5',
    ];
    const out: Partial<Record<Square, CellFeedback>> = {};
    ALL_FEEDBACK_KINDS.forEach((kind, idx) => {
      const sq = squares[idx];
      if (sq === undefined) return;
      out[sq] = { kind, pulse: kind === 'check' || kind === 'star' };
    });
    return out;
  }, []);

  return (
    <ExampleSection
      title={<Trans>Cell feedback</Trans>}
      description={
        <Trans>
          Per-square indicators; pulse animation for highlighted moves.
        </Trans>
      }
    >
      <ChessBoard
        fen={STARTING_FEN}
        cellFeedback={cellFeedback}
        interactive={false}
        showCoordinates
      />
      <Stack spacing={1} sx={{ marginTop: 2 }}>
        {ALL_FEEDBACK_KINDS.map((kind, idx) => (
          <Text
            key={kind}
            variant="caption"
            sx={{ color: 'textSecondary' }}
            label={`${idx + 1}. ${kind}`}
          />
        ))}
      </Stack>
    </ExampleSection>
  );
}

function ArrowsSection(): ReactNode {
  const arrows = useMemo<readonly BoardArrow[]>(
    () => [
      { from: 'e2', to: 'e4', id: 'a-e2e4' },
      { from: 'd2', to: 'd4', id: 'a-d2d4', color: '#1565d8' },
      { from: 'b1', to: 'c3', id: 'a-knight-l', color: '#caa30a' },
      { from: 'g1', to: 'f3', id: 'a-knight-l-2', color: '#1f9d4a' },
      {
        from: 'f1',
        to: 'c4',
        id: 'a-bishop-plan',
        color: '#7e3ad0',
        dashed: true,
      },
      {
        from: 'd1',
        to: 'h5',
        id: 'a-queen-threat',
        color: '#d63a3a',
        thickness: 0.18,
      },
    ],
    []
  );
  return (
    <ExampleSection
      title={<Trans>Arrows</Trans>}
      description={
        <Trans>
          Straight and knight L-shape arrows, dashed plan lines, and color
          overrides.
        </Trans>
      }
    >
      <ChessBoard
        fen={SMITH_MORRA_FEN}
        arrows={arrows}
        interactive={false}
        showCoordinates
      />
    </ExampleSection>
  );
}

function HighlightsSection(): ReactNode {
  const cellHighlights = useMemo<Partial<Record<Square, CellHighlight>>>(
    () => ({
      e4: { color: '#1f9d4a', opacity: 0.4 },
      d4: { color: '#1565d8', opacity: 0.35 },
      e5: { color: '#d63a3a', ring: true, opacity: 0.85 },
      d5: { color: '#caa30a', ring: true, opacity: 0.85 },
    }),
    []
  );
  return (
    <ExampleSection
      title={<Trans>Cell highlights</Trans>}
      description={
        <Trans>
          Solid fills and ring borders — for color-coded threats, defended
          squares, etc.
        </Trans>
      }
    >
      <ChessBoard
        fen={STARTING_FEN}
        cellHighlights={cellHighlights}
        interactive={false}
        showCoordinates
      />
    </ExampleSection>
  );
}

function PromotionSection(): ReactNode {
  const [resetNonce, setResetNonce] = useState(0);
  return (
    <ExampleSection
      title={<Trans>Promotion</Trans>}
      description={
        <Trans>
          Move the white pawn to a8 to trigger the inline canvas promotion
          picker.
        </Trans>
      }
    >
      <Stack spacing={3}>
        <ChessBoard
          key={`promo-${resetNonce}`}
          fen={PRE_PROMOTION_FEN}
          showCoordinates
          highlightLastMove
          highlightLegalMoves
        />
        <Button
          intent="neutral"
          title={<Trans>Reset position</Trans>}
          onPress={() => setResetNonce((n) => n + 1)}
        />
      </Stack>
    </ExampleSection>
  );
}

function UserArrowsSection(): ReactNode {
  const [enabled, setEnabled] = useState(true);
  const [arrows, setArrows] = useState<readonly BoardArrow[]>([]);
  const { t } = useLingui();
  return (
    <ExampleSection
      title={<Trans>User-drawn arrows</Trans>}
      description={
        <Trans>
          Right-click + drag to draw arrows. Hold Shift (red), Alt (blue),
          Ctrl/Cmd (yellow). Right-click the same arrow to erase.
        </Trans>
      }
    >
      <Stack spacing={3}>
        <Switch
          label={t`Enable user arrows`}
          value={enabled}
          onValueChange={setEnabled}
        />
        <ChessBoard
          enableUserArrows={enabled}
          onUserArrowsChange={setArrows}
          showCoordinates
          highlightLegalMoves
        />
        <Text
          variant="caption"
          sx={{ color: 'textSecondary' }}
          label={(() => {
            const count = arrows.length;
            return t`${count} user arrow(s) drawn`;
          })()}
        />
      </Stack>
    </ExampleSection>
  );
}

function ThemedSection(): ReactNode {
  const purpleTheme = useMemo<Partial<BoardTheme>>(
    () => ({
      lightSquare: '#ece4f7',
      darkSquare: '#7e3ad0',
      lastMove: '#caa30a',
      selected: '#ffd64a',
    }),
    []
  );
  const greenTheme = useMemo<Partial<BoardTheme>>(
    () => ({
      lightSquare: '#eeeed2',
      darkSquare: '#769656',
      lastMove: '#f7ec74',
      selected: '#f7ec74',
    }),
    []
  );
  return (
    <ExampleSection
      title={<Trans>Themed boards</Trans>}
      description={
        <Trans>
          Pass `theme` to override any board color (squares, highlights, arrows,
          feedback).
        </Trans>
      }
    >
      <Stack spacing={3}>
        <ChessBoard
          fen={PUZZLE_COMBINATION_FEN}
          theme={greenTheme}
          interactive={false}
          showCoordinates
        />
        <Divider />
        <ChessBoard
          fen={PUZZLE_COMBINATION_FEN}
          theme={purpleTheme}
          interactive={false}
          showCoordinates
        />
      </Stack>
    </ExampleSection>
  );
}

function MovesPlayedSection(): ReactNode {
  const [moves, setMoves] = useState<readonly Move[]>([]);
  return (
    <ExampleSection
      title={<Trans>Move log</Trans>}
      description={
        <Trans>Plays a fresh game and prints SAN moves as they happen.</Trans>
      }
    >
      <Stack spacing={3}>
        <ChessBoard
          onMove={(m) => setMoves((prev) => [...prev, m])}
          showCoordinates
          highlightLastMove
          highlightLegalMoves
        />
        <Card elevation={0} sx={{ p: 3 }}>
          <Text variant="label" label={<Trans>SAN</Trans>} />
          <Text
            variant="caption"
            sx={{ color: 'textSecondary' }}
            label={
              moves.length === 0
                ? '— no moves yet —'
                : moves.map((m) => m.san ?? `${m.from}${m.to}`).join(' ')
            }
          />
        </Card>
        <Button
          intent="neutral"
          title={<Trans>Clear log</Trans>}
          onPress={() => setMoves([])}
        />
      </Stack>
    </ExampleSection>
  );
}

export default function ChessBoardExample(): ReactNode {
  return (
    <Box sx={{ p: 4, gap: 6 }}>
      <Text variant="heading" label={<Trans>ChessBoard</Trans>} />
      <Text
        variant="body"
        sx={{ color: 'textSecondary' }}
        label={
          <Trans>
            Skia-rendered chess board with annotation primitives, inline
            promotion, react-native-reanimated-dnd piece interaction, and theming.
          </Trans>
        }
      />

      <BasicsSection />
      <Divider />
      <FeedbackSection />
      <Divider />
      <ArrowsSection />
      <Divider />
      <HighlightsSection />
      <Divider />
      <PromotionSection />
      <Divider />
      <UserArrowsSection />
      <Divider />
      <ThemedSection />
      <Divider />
      <MovesPlayedSection />
    </Box>
  );
}
