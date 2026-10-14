import type { JSX } from 'solid-js';
import { EmbeddedScreen, type EmbeddedScreenProps } from './embedded-screen';
import { GameSessionLayout } from './game-session-layout';

export type GameReviewScreenProps = Pick<
  EmbeddedScreenProps,
  'screenId' | 'title' | 'subtitle' | 'dataSet'
> & {
  children: JSX.Element;
  timeline?: JSX.Element | undefined;
  actions?: JSX.Element | undefined;
  aside?: JSX.Element | undefined;
};

/** Review any completed round with the same stage and optional record rail. */
export function GameReviewScreen(props: GameReviewScreenProps): JSX.Element {
  return (
    <EmbeddedScreen
      screenId={props.screenId}
      title={props.title}
      subtitle={props.subtitle}
      width={props.aside ? 'stage' : 'reading'}
      dataSet={{ component: 'GameReviewScreen', ...props.dataSet }}
    >
      <GameSessionLayout
        aside={props.aside}
        status={props.timeline}
        actions={props.actions}
      >
        {props.children}
      </GameSessionLayout>
    </EmbeddedScreen>
  );
}
