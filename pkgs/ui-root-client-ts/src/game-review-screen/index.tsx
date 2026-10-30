import type { JSX } from 'solid-js';
import {
  EmbeddedScreen,
  type EmbeddedScreenProps,
} from '../embedded-screen/index';
import { GameSessionLayout } from '../game-session-layout/index';
import { createScreenSlot } from '../screen-slot';

export type GameReviewScreenProps = Pick<
  EmbeddedScreenProps,
  'screenId' | 'title' | 'subtitle' | 'dataSet' | 'nested'
> & {
  children: JSX.Element;
  timeline?: JSX.Element | undefined;
  actions?: JSX.Element | undefined;
  aside?: JSX.Element | undefined;
};

/** Review any completed round with the same stage and optional record rail. */
export function GameReviewScreen(props: GameReviewScreenProps): JSX.Element {
  const aside = createScreenSlot(() => props.aside);
  return (
    <EmbeddedScreen
      screenId={props.screenId}
      title={props.title}
      subtitle={props.subtitle}
      nested={props.nested}
      width={aside.present() ? 'full' : 'menu'}
      dataSet={{ component: 'GameReviewScreen', ...props.dataSet }}
    >
      <GameSessionLayout
        aside={aside.content()}
        status={props.timeline}
        actions={props.actions}
      >
        {props.children}
      </GameSessionLayout>
    </EmbeddedScreen>
  );
}
