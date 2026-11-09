import { children, type JSX, Show } from 'solid-js';
import { GameDisclosure } from '../game-disclosure';
import { useThemeLayout } from '../theme-context';

/** On a short, narrow phone the passing hand is the primary task. Keep
 * the full player table available through the existing disclosure, and
 * show it directly as soon as tricks begin or more space is available. */
export function CardTableContext(props: {
  passing: boolean;
  summary: string | undefined;
  testId: string;
  children: JSX.Element;
}): JSX.Element {
  const theme = useThemeLayout();
  const content = children(() => props.children);
  const compact = () =>
    props.passing &&
    props.summary !== undefined &&
    theme.layout().width <= 360 &&
    theme.layout().height <= 640;
  return (
    <Show when={compact()} fallback={content()}>
      <GameDisclosure
        title={props.summary}
        rule={false}
        dataSet={{ testid: `${props.testId}-table-toggle` }}
      >
        {content()}
      </GameDisclosure>
    </Show>
  );
}
