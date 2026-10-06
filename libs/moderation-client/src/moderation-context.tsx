import type { ModerationRules } from '@libs/moderation-shared/moderation-rules';
import type { AppModeration } from '@libs/moderation-shared/policy';
import type { Accessor, JSX, ParentProps } from 'solid-js';
import {
  createContext,
  createSignal,
  onCleanup,
  untrack,
  useContext,
} from 'solid-js';

const ModerationContext = createContext<Accessor<AppModeration>>();

/**
 * Puts the device's moderation (`ClientEnv.moderation`) in reach of every
 * screen. A change to the team's rules re-judges every name on screen at
 * once — it ships with the app, so no connection is needed.
 */
export function ModerationProvider(
  props: ParentProps<{ readonly rules: ModerationRules }>
): JSX.Element {
  // Composition-root configuration: the rules object never changes.
  const rules = untrack(() => props.rules);
  const [moderation, setModeration] = createSignal(rules.current());
  onCleanup(rules.subscribe(() => setModeration(() => rules.current())));
  return (
    <ModerationContext.Provider value={moderation}>
      {props.children}
    </ModerationContext.Provider>
  );
}

/** The moderation names and forms are judged by, tracking rule changes. */
export function useModeration(): Accessor<AppModeration> {
  const moderation = useContext(ModerationContext);
  if (moderation === undefined) {
    throw new Error('useModeration: no ModerationProvider above this screen');
  }
  return moderation;
}
