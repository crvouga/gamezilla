import type { PuzzlePlayerProps } from '@libs/game-puzzle-client-ts/puzzle-content-client';
import type {
  GameBoardProps,
  GameSimulationControls,
} from '@pkgs/turn-game-shared-ts/game-presentation';
import type { GameRules, GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import type { PuzzleRules } from '@pkgs/turn-game-shared-ts/puzzle-content';
import type { JSX } from '@solidjs/web';

export type PracticeBoardProps = {
  readonly position: string;
  readonly syncKey: number;
  readonly complete: boolean;
  readonly onAction: (action: string) => void;
  readonly onLeave: () => void;
};

type StepCopy = {
  readonly prompt: () => string;
  readonly success: () => string;
};

export type LessonStep = StepCopy & {
  readonly Board: (props: PracticeBoardProps) => JSX.Element;
  readonly initial: () => string;
  /** A refused attempt leaves the practice position and goal in place. */
  readonly play: (position: string, action: string) => string | null;
  readonly reachedGoal?: (position: string) => boolean;
};

export type GameLesson = readonly [LessonStep, LessonStep, ...LessonStep[]];

type MatchBoard = (props: GameBoardProps) => JSX.Element;

/** A match board receives just this exercise's position and local input. */
export function practiceBoard(
  Board: MatchBoard,
  options: {
    readonly side?: GameSide;
    readonly hand?: (position: string) => string;
    readonly setup?: string;
    readonly simulationInput?: (input: unknown) => string | null;
  } = {}
): LessonStep['Board'] {
  return (props) => {
    const encodeInput = options.simulationInput;
    const simulation: GameSimulationControls | undefined = encodeInput && {
      sides: ['white'],
      get paused() {
        return props.complete;
      },
      stale: false,
      onInput: (_side, input) => {
        const action = encodeInput(input);
        if (action !== null) props.onAction(action);
      },
      onRelease: () => undefined,
    };
    return (
      <Board
        position={props.position}
        orientation={options.side ?? 'white'}
        interactive={!props.complete}
        hand={options.hand?.(props.position) ?? null}
        setup={options.setup ?? null}
        committed={[]}
        commitment={null}
        syncKey={props.syncKey}
        sound={false}
        testId="practice-board"
        onAction={props.onAction}
        simulation={simulation}
      />
    );
  };
}

export function turnLessonStep(
  rules: GameRules,
  Board: LessonStep['Board'],
  step: StepCopy & {
    readonly before: readonly string[];
    readonly action: string;
  }
): LessonStep {
  return {
    ...step,
    Board,
    initial: () => rules.replay(step.before, step.before.length),
    play: (position, action) =>
      action === step.action
        ? (rules.play(position, action, '', step.before)?.position ?? null)
        : null,
  };
}

export function puzzleLessonStep(
  rules: PuzzleRules,
  Player: (
    props: PuzzlePlayerProps & {
      readonly onLeave: () => void;
    }
  ) => JSX.Element,
  step: StepCopy & {
    readonly definition: string;
    readonly before?: readonly string[];
    readonly accepts?: (action: string) => boolean;
    readonly reachedGoal?: (state: string) => boolean;
    readonly initial?: () => string;
  }
): LessonStep {
  return {
    ...step,
    initial:
      step.initial ??
      (() => {
        let start = rules.initial(step.definition);
        for (const action of step.before ?? []) {
          if (!start.accepted) break;
          start = rules.apply(step.definition, start.state, action);
        }
        if (!start.accepted)
          throw new Error(start.issues.map((issue) => issue.message).join(' '));
        return start.state;
      }),
    Board: (props) => (
      <Player
        definition={step.definition}
        state={props.position}
        disabled={false}
        onAction={props.onAction}
        onLeave={props.onLeave}
        context={{ kind: 'single', shellOffersWayOn: true }}
      />
    ),
    play: (state, action) => {
      if (step.accepts && !step.accepts(action)) return null;
      const change = rules.apply(step.definition, state, action);
      return change.accepted ? change.state : null;
    },
  };
}
