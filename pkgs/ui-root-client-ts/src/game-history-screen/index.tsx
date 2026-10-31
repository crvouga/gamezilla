import type { JSX } from 'solid-js';
import {
  EmbeddedScreen,
  type EmbeddedScreenProps,
} from '../embedded-screen/index';

export type GameHistoryScreenProps = Pick<
  EmbeddedScreenProps,
  'screenId' | 'title' | 'subtitle' | 'dataSet' | 'nested'
> & {
  summary?: JSX.Element | undefined;
  trend?: JSX.Element | undefined;
  statistics?: JSX.Element | undefined;
  filters?: JSX.Element | undefined;
  children: JSX.Element;
};

/** Puzzle attempts and player games share one summary → trend → record rhythm. */
export function GameHistoryScreen(props: GameHistoryScreenProps): JSX.Element {
  return (
    <EmbeddedScreen
      screenId={props.screenId}
      title={props.title}
      subtitle={props.subtitle}
      nested={props.nested}
      dataSet={{ component: 'GameHistoryScreen', ...props.dataSet }}
    >
      {props.summary}
      {props.trend}
      {props.statistics}
      {props.filters}
      {props.children}
    </EmbeddedScreen>
  );
}
