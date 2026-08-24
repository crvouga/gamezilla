import { createElement, type ReactElement } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';

export const MULTI_APP_HOST_TEST_ID = 'ui-testing:multi-app-host';
export const MULTI_APP_ACTOR_SHELL_PREFIX = 'ui-testing:actor:';

/** Phone frame used by sim DST / Jest safe-area fallback (390×844). */
export const MULTI_APP_ACTOR_FRAME = {
  width: 390,
  height: 844,
} as const;

export function actorShellTestId(actorId: string): string {
  return `${MULTI_APP_ACTOR_SHELL_PREFIX}${actorId}`;
}

export type MultiAppHostProps = {
  readonly actors: ReadonlyMap<string, ReactElement>;
  /** Only this actor is mounted in the RNTL tree (one full-screen app at a time). */
  readonly activeActorId?: string;
};

const hostStyle: StyleProp<ViewStyle> = {
  width: MULTI_APP_ACTOR_FRAME.width,
  height: MULTI_APP_ACTOR_FRAME.height,
  position: 'relative',
  overflow: 'hidden',
};

const actorShellStyle: StyleProp<ViewStyle> = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: MULTI_APP_ACTOR_FRAME.width,
  height: MULTI_APP_ACTOR_FRAME.height,
  overflow: 'hidden',
};

/**
 * Single RNTL mount that hosts one active app root at a time.
 * Inactive actors stay registered in the session but unmounted so each
 * `ProductApp` gets full layout bounds and an isolated sync tree.
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
