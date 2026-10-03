import { defineAction } from '@pkgs/harness';
import { readAnnotations } from './annotation-reads';
import type { BoardWorld } from './board-world';
export type ArrowAppearance =
  | 'default'
  | 'danger'
  | 'bright green'
  | 'bright green dashed';
export type FeedbackAppearance = 'usual' | 'centered' | 'gold';
export const chooseActivityArrow = defineAction({
  name: 'chooseActivityArrow',
  act(w: BoardWorld, appearance: ArrowAppearance) {
    w.app.configure({
      arrows: [
        {
          from: 'e2',
          to: 'e4',
          ...(appearance === 'default'
            ? {}
            : { color: appearance === 'danger' ? 'danger' : '#00ff00' }),
          ...(appearance === 'bright green dashed' ? { dashed: true } : {}),
        },
      ],
    });
  },
});
export const supplyFeedbackMarks = defineAction({
  name: 'supplyFeedbackMarks',
  act(w: BoardWorld, appearance: FeedbackAppearance) {
    const marks =
      appearance === 'usual'
        ? {
            e4: { kind: 'check' as const },
            d5: { kind: 'cross' as const },
            f3: { kind: 'doubleExclam' as const },
          }
        : {
            e4: {
              kind: 'check' as const,
              ...(appearance === 'centered'
                ? { corner: 'center' as const }
                : { color: 'gold' }),
            },
          };
    w.app.configure({ cellHighlights: {}, cellFeedback: marks });
  },
});
const COLORS: Readonly<Record<string, string>> = {
  '#1f9d4a': 'green',
  '#3ad07a': 'green',
  green: 'green',
  '#d63a3a': 'red',
  '#f06464': 'red',
  red: 'red',
  '#1565d8': 'blue',
  '#3a8cff': 'blue',
  blue: 'blue',
  '#00ff00': 'bright green',
  gold: 'gold',
};
export function appearanceColor(color: string | null | undefined) {
  return COLORS[color?.toLowerCase() ?? ''] ?? `unrecognized: ${color}`;
}
function describeArrow(
  a: ReturnType<typeof readAnnotations>['arrows'][number]
) {
  return {
    endpoints: a.token.split('@')[1]?.replace('-', ' to ') ?? 'unrecognized',
    color: appearanceColor(a.color),
    line: a.dashed ? 'dashed' : 'solid',
    opacity: a.opacity,
  };
}
export const readArrowAppearances = (w: BoardWorld) =>
  readAnnotations(w).arrows.map(describeArrow);
export const readActivityArrowAppearances = (w: BoardWorld) =>
  readAnnotations(w).activityArrows.map(describeArrow);
export const readArrowAt = (w: BoardWorld, endpoints: string) => {
  const a = readArrowAppearances(w).find(
    (arrow) => arrow.endpoints === endpoints
  );
  return a === undefined
    ? null
    : { ...a, visible: a.opacity > 0 && a.opacity <= 1 };
};
export const readPersonalArrowReport = (w: BoardWorld) => ({
  changes: w.app.userArrowChanges(),
  painted: readArrowAppearances(w),
});
export const appearanceActions = [chooseActivityArrow, supplyFeedbackMarks];
