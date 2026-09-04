import { createElement, type ReactElement } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';

import { MULTI_APP_ACTOR_FRAME } from './snapshot-frame';

export { MULTI_APP_ACTOR_FRAME } from './snapshot-frame';

export const MULTI_APP_HOST_TEST_ID = 'ui-testing:multi-app-host';
export const MULTI_APP_ACTOR_SHELL_PREFIX = 'ui-testing:actor:';

export function actorShellTestId(actorId: string): string {
  return `${MULTI_APP_ACTOR_SHELL_PREFIX}${actorId}`;
}

export type MultiAppHostProps = {
  readonly actors: ReadonlyMap<string, ReactElement>;
  /** Only this actor is mounted in the RNTL tree; others stay registered but parked. */
  readonly activeActorId?: string;
};

const hostStyle: StyleProp<ViewStyle> = {
  width: MULTI_APP_ACTOR_FRAME.width,
  height: MULTI_APP_ACTOR_FRAME.height,
  position: 'relative',
  overflow: 'hidden',
};

const actorShellStyle: StyleProp<ViewStyle> = {
  width: MULTI_APP_ACTOR_FRAME.width,
  height: MULTI_APP_ACTOR_FRAME.height,
  overflow: 'hidden',
};

/**
 * Single RNTL mount for one active actor shell at a time.
 */
export function MultiAppHost(props: MultiAppHostProps): ReactElement {
  const { actors, activeActorId } = props;

  if (activeActorId === undefined) {
    return createElement(View, {
      testID: MULTI_APP_HOST_TEST_ID,
      style: hostStyle,
    });
  }

  const element = actors.get(activeActorId);
  if (element === undefined) {
    return createElement(View, {
      testID: MULTI_APP_HOST_TEST_ID,
      style: hostStyle,
    });
  }

  return createElement(
    View,
    { testID: MULTI_APP_HOST_TEST_ID, style: hostStyle },
    createElement(
      View,
      {
        testID: actorShellTestId(activeActorId),
        style: actorShellStyle,
      },
      element
    )
  );
}
